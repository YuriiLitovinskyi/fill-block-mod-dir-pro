class PpkBlModDirClass {
    constructor(ppkNumber){
        this.ppkNumber = ppkNumber;
    };

    getData(){
        const blockNumber = Math.ceil(this.ppkNumber / 64)

        const moduleNumber = Math.ceil(this.ppkNumber / 8) - (Math.ceil(this.ppkNumber / 64) * 8 - 8)

        let directionNumber = this.ppkNumber - (Math.floor(this.ppkNumber / 8) * 8)
        if(directionNumber === 0){
            directionNumber += 8
        }

        return {
            blockNumber,
            moduleNumber,
            directionNumber
        }
    }
};

module.exports = PpkBlModDirClass;