const Firebird = require('node-firebird')
const Confirm = require('prompt-confirm')
const chalk = require('chalk')
const PpkBlModDirClass = require('./PpkBlModDirClass')


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
            if(err) throw err
        
            console.log(chalk.yellow(' Connected to DB successfully! \n'))
        
            const R1000Ids = await findR1000Id(db)
          
            const ids = await extractIdsFromArrayOfObjects(R1000Ids)
            
            const ppks =  await findPpksAndIds(db, ids)            

            const res = await insertBlockModDir(db, ppks)
                       
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
            if(err) throw err
              
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
            if(err) throw err

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
                if(err) throw err           
    
                console.log(chalk.green(` Inserted for ppk ${ids[i].OID}, ${ids[i].NAME}`))
            })
        }
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