import {inject} from 'aurelia-framework'
import {Router} from 'aurelia-router'

import p2p from 'socket.io-p2p'
import io from 'socket.io-client'

import lodash from 'lodash'
import $ from 'jquery'
import Dropzone from 'dropzone'

import filereader from './filereader'
import downloader from './downloader'

import Config from './config'

@inject(Router)
export class Index {

  isUploader = true
  connectedToPeer = false

  token = null

  file = null
  previewImage = null
  uploading = false
  uploadComplete = false

  downloader = null

  constructor(router) {
    this.router = router
    Dropzone.autoDiscover = false
    Dropzone.autoProcessQueue = false
    this.downloader = new downloader()
    this.config = new Config()
    this.serverUrl = this.config.serverUrl
  }

  activate(params) {
    if(params.token) {
      this.isUploader = false
      this.token = params.token
    }
  }

  bind() {
    if(this.isUploader) {
      this.initDropzone()
    }

    this.socket = io(this.config.apiUrl)
  
    this.socket.on('connect', () => {
      if(this.token) {
        this.socket.emit('set-token', this.token)
      }
    }.bind(this))

    this.socket.on('error', err => {
      console.error(err)
    }.bind(this))

    this.socket.on('set-token-invalid', () => {
      this.router.navigate('/')
      location.reload()
    }.bind(this))

    this.socket.on('set-token-ok', token => {
      this.token = token

      this.p2p = new p2p(this.socket, {
        peerOpts: {
          trickle: false,
          config: {
            "iceServers": [
              {"url":"stun:23.21.150.121","urls":"stun:23.21.150.121"}
            ]}
        }
      })

      this.p2p.on('ready', function() {
        this.p2p.usePeerConnection = true
      }.bind(this))

      this.p2p.on('upgrade', data => {
        this.connectedToPeer = true

        if (this.file) {
          this.startUpload()
        }
      }.bind(this))

      this.p2p.on('peer-error', err => {
        console.error(err)
        this.connectedToPeer = false
      }.bind(this))

      this.p2p.on('error', err => {
        console.error(err)
        this.connectedToPeer = false
      }.bind(this))

      this.p2p.on('data', packet => {
        this.downloader.addChunk(packet.fileName, packet.fileSize, packet.data, packet.complete)
      }.bind(this))
    }.bind(this))
  }

  initDropzone() {
    var view = this

    setTimeout(() => {
      this.dropzone = new Dropzone("div#dropzone", {
        url: "/file/post",
        addedfile: file => {
          view.fileAdded(file)
        }.bind(this),
        thumbnail: (file, dataUrl) => {
          this.previewImage = dataUrl
        }.bind(this),
        uploadprogress: () => {},
        autoProcessQueue: false
      })
    }.bind(this), 0)
  }

  fileAdded(file) {
    $('#dropzone-text').html(file.name)
    this.fileName = file.name
    this.contentType = file.type
    this.file = file
    this.socket.emit('ask-token')
  }

  startUpload() {
    if(!this.file || !this.connectedToPeer) {
      return
    }

    this.uploading = true
    var fileName = this.fileName.split('\\').pop()

    this.reader = new filereader(this.file)
    this.reader.readFile(function(data, complete) {
      this.p2p.emit('data', {
        fileName: fileName,
        fileSize: this.reader.fileSize,
        data: data,
        complete: complete
      })

      if(complete) {
        this.uploadComplete = true
      }
    }.bind(this))
  }

}
