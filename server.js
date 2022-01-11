const Firebird = require('node-firebird')
const Confirm = require('prompt-confirm')
const chalk = require('chalk')
const PpkBlModDirClass = require('./PpkBlModDirClass')

const version = '2.0'

const question = new Confirm (chalk.red('\n Do you really want to fill Block/Module/Direction in Dunay DB automatically?'))

const options = {
    host: '127.0.0.1',
    port: 3050,
    database: 'Danube',
    user: 'SYSDBA',
    password: 'idonotcare',
    lowercase_keys: false,
    role: null
}

const sleep = (timeout) => {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout)
    })
}

question.ask(async function(answer){
    if(answer){
        Firebird.attach(options, async function(err, db){
            if(err){
                console.log(chalk.red('\n Error! Could not connect to database!'))             
                //process.exit(1)
                throw err
            }           

            console.log(chalk.yellow(` Program version: ${version}  \n`))
            console.log(chalk.yellow(' Connected to DB successfully! \n'))
                                
            const R1000Ids = await findR1000Id(db)
            
            if(!R1000Ids.length) {
                console.log(chalk.grey('\n No R1000 found! Application will be closed in 5 seconds'))
                db.detach()
                await sleep(5000)
            }
            
            /* next function is neded to bypass the trigger named 'TR_ATU_DNBR1000_ROUTE_BU',
            which is raising exeption when there are two or more identical 'PARENT_ID's in 'ATU_DNBR1000_ROUTE' table */
            await clearBlockModuleDirectionParentId(db)
            
            const ids = await extractIdsFromArrayOfObjects(R1000Ids)
            
            const ppks =  await findPpksAndIds(db, ids)
            
            if(!ppks.length) {
                console.log(chalk.grey('\n No PPK found! Application will be closed in 5 seconds'))
                db.detach()
                await sleep(5000)
            }           

            await insertBlockModDir(db, ppks)
                        
            db.detach()

            await sleep(5000)
            
            console.log(chalk.yellow('\n Operation completed successfully!')) // will be seen if program was run using .bat file                
        })
    }
    else {
        console.log(chalk.yellow(' Program will be closed in 5 seconds'))
        await sleep(5000)
    }
})


// Find all parent elements
//  @table:        'OBJECTS'
//  @name:         'Дунай P1000'
//  @class_name:   'ATU_DNBR1000'
function findR1000Id(db){
    return new Promise((resolve, reject) => {
        const findR1000IdQuery = `SELECT id FROM objects WHERE class_name = 'ATU_DNBR1000';`    
    
        db.query(findR1000IdQuery, function(err, result){
            if(err) {
                console.log(chalk.red('\n Error! Could not find R1000 Ids in database!'))  
                throw err
            }
              
            resolve(result)            
        })
    })
}


// Find all ppks according to parent (R1000) Ids
//  @table:        'OBJECTS'
function findPpksAndIds(db, R1000Ids){
    return new Promise((resolve, reject) => {
        const findPpksQuery = `SELECT id, oid, name FROM objects WHERE parent_id IN (${R1000Ids}) AND oid > 0;`
    
        db.query(findPpksQuery, function(err, result){
            if(err) {
                console.log(chalk.red('\n Error! Could not find ppks Ids in database!'))  
                throw err
            }

            resolve(result)
        })
    })   
}


// Insert Block/Module/Direction for every PPK
//  @table:        'ATU_DNBR1000_ROUTE'
//  @name:         'Дунай P1000'
//  @class_name:   'ATU_DNBR1000'
function insertBlockModDir(db, ids){
    return new Promise((resolve, reject) => {  
        for(let i = 0; i < ids.length; i++){
            const ppkObject = new PpkBlModDirClass(ids[i].OID)
            const blockModDir = ppkObject.getData()
            const query = `UPDATE ATU_DNBR1000_ROUTE SET 
                    block_oid = ${blockModDir.blockNumber}, 
                    module_oid = ${blockModDir.moduleNumber}, 
                    direction_oid = ${blockModDir.directionNumber},
                    first_port = 1
                WHERE child_id = ${ids[i].ID};`
    
            db.query(query, async function(err, result){
                if(err) {
                    console.log(chalk.red(`\n Error! Could not insert data for ppk ${ids[i].OID}, "${ids[i].NAME}" in database!`))  
                    throw err
                }           
    
                console.log(chalk.green(` Inserted for ppk ${ids[i].OID}, ${ids[i].NAME}`))
            })
        }
        resolve('ok')     
    })
}


// Set Block/Module/Direction to 0 and PARENT_ID to NULL for every PPK
//  @table:        'ATU_DNBR1000_ROUTE'
function clearBlockModuleDirectionParentId(db){
    return new Promise((resolve, reject) => {
        const query = 'UPDATE atu_dnbr1000_route SET BLOCK_OID = 0, MODULE_OID = 0, DIRECTION_OID = 0, FIRST_PORT = 0, PARENT_ID = NULL;'

        db.query(query, async function(err, result){
            if(err){
                console.log(chalk.red(`\n Error! Could not set Block/Module/Direction to 0/0/0 and parent id to NULL in database!`))  
                throw err
            }

            console.log(chalk.yellow(` Setting Block/Module/Direction to 0/0/0 and parent id to NULL for all ppks... \n`))
        })
        resolve('ok') 
    })
}


function extractIdsFromArrayOfObjects(array){
    return new Promise((resolve, reject) => {
        let Ids = ''
    
        for(let i = 0; i < array.length; i++){   
            if(!Ids){
                Ids = array[i].ID
            } else {
                Ids = Ids + ', ' + array[i].ID
            }   
        }
    
        resolve(Ids)        
    })
}