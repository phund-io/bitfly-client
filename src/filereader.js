export default class Reader {

    constructor(file) {
      this.file = file
      this.chunkSize = 542288
      this.pos = 0
      this.fileSize = 0
      this.percentComplete = 0

      this.reader = new FileReader()
      this.reader.onload = function(e) {
        this.onChunkLoaded()
      }.bind(this)
    }

    readFile(cb) {
      this.readCallback = cb
      this.loadNextChunk()
    }

    onChunkLoaded() {
      this.fileSize = this.file.size

      var data = this.reader.result

      this.pos += data.byteLength
      this.percentComplete = (this.pos / this.fileSize) * 100.0
      var complete = this.pos >= this.fileSize

      if(this.readCallback) {
        this.readCallback(data, complete)
      }

      if(!complete) {
        this.loadNextChunk()
      }
    }

    loadNextChunk() {
      this.reader.readAsArrayBuffer(this.file.slice(this.pos, this.pos + this.chunkSize));
    }

}
