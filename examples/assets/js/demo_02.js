(() => {
  
  /**
   * WebRTCによるカメラアクセス
   */
  const video = document.getElementById('video')
  const canvas = document.getElementById('canvas')
  const ctx = canvas.getContext('2d')
  
  let isVideoRun = true
  let isLoadedMetaData = false
  let constraints = { audio: false, video: {facingMode: 'user'} }

  let update_memory = pico.instantiate_detection_memory(5) // we will use detections of the last 5 frames
  let facefinder_classify_region = function(r, c, s, pixels, ldim){ return -1.0; }
  let cascadeurl = 'https://raw.githubusercontent.com/nenadmarkus/pico/c2e81f9d23cc11d1a612fd21e4f9de0921a5d0d9/rnt/cascades/facefinder'
  let threshold = document.getElementById('threshold')
  let thresholdVal = document.querySelector('.threshold_txt')
  let ghostImg = new Image()
  let isFaceDetect = false
  let result = {x: 0, y: 0, w: 0, h: 0}
  let countNum = 0
  let intervalFrameNum = 5


  function start(){
    // prepare the pico.js face detector
    fetch(cascadeurl).then( (response) => {
      response.arrayBuffer().then( (buffer) => {
        let bytes = new Int8Array( buffer )
        facefinder_classify_region = pico.unpack_cascade( bytes )
        console.log('* cascade loaded')

        // start webcam
        navigator.mediaDevices.getUserMedia( constraints )
          .then( mediaStrmSuccess )
          .catch( mediaStrmFailed )
  
      })
    })
  }

  function mediaStrmSuccess( stream ){
    video.srcObject = stream

    // ウェブカムのサイズを取得し、canvasにも適用
    if(isLoadedMetaData) return
    isLoadedMetaData = true

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth  
      canvas.height = video.videoHeight

      requestAnimationFrame( draw )
    }, false)
  }

  function mediaStrmFailed( e ){
    console.log( e )
  }

  function stop(){
    let stream = video.srcObject
    let tracks = stream.getTracks()

    tracks.forEach( (track) => {
      track.stop()
    })
    video.srcObject = null
  }

  function draw(){
    if(isVideoRun){
      detectFace()
    }
    requestAnimationFrame( draw )
  }

  start()


  /**
   * ストリームのコントロール
   */
  const stopBtn = document.getElementById('stop')
  const frontBtn = document.getElementById('front')
  const rearBtn = document.getElementById('rear')

  let ua = navigator.userAgent
  if(ua.indexOf('iPhone') < 0 && ua.indexOf('Android') < 0 && ua.indexOf('Mobile') < 0 && ua.indexOf('iPad') < 0){
    frontBtn.disabled = true
    rearBtn.disabled = true
  }

  stopBtn.addEventListener('click', () => {
    if(isVideoRun){
      stop()
      stopBtn.textContent = 'START'
    }else{
      start()
      stopBtn.textContent = 'STOP'
    }
    isVideoRun = !isVideoRun
  }, false)

  frontBtn.addEventListener('click', () => {
    stop()
    constraints.video.facingMode = 'user'
    setTimeout( () => {
      start()
    }, 500)
  }, false)

  rearBtn.addEventListener('click', () => {
    stop()
    constraints.video.facingMode = 'environment'
    setTimeout( () => {
      start()
    }, 500)
  }, false)


  /**
   * 顔の認識
   */

  thresholdVal.textContent = threshold.value

  threshold.addEventListener('input', (e) => {
    thresholdVal.textContent = e.currentTarget.value
  }, false)

  ghostImg.src = './assets/img/fig_ghost_01.png'

  function detectFace(){
    ctx.globalAlpha = 1
    ctx.drawImage(video, 0, 0)

    let canW = canvas.width
    let canH = canvas.height

    let rgba = ctx.getImageData(0, 0, canW, canH).data

    let image = {
      'pixels': rgba_to_grayscale(rgba, canW, canH),
      'nrows': canH,
      'ncols': canW,
      'ldim': canW
    }
    let params = {
      'shiftfactor': 0.1,     // move the detection window by 10% of its size
      'minsize': 100,         // minimum size of a face
      'maxsize': 1000,        // maximum size of a face
      'scalefactor': 1.1      // for multiscale processing: resize the detection window by 10% when moving to the higher scale
    }

    // run the cascade over the frame and cluster the obtained detections
    // dets is an array that contains(r, c, s, q) quadruplets
    // (representing row, column, scale and detection score)
    if(countNum === 0){
      let dets = pico.run_cascade(image, facefinder_classify_region, params)
      dets = update_memory(dets)
      dets = pico.cluster_detections(dets, 0.2)   // set IoU threshold to 0.2
    
      for(let i = 0; i < dets.length; ++i){
        // check the detection score
        // if it's above the threshold, draw it
        // (the constant 50.0 is empirical: other cascades might require a different one)
        if(dets[i][3] > threshold.value){
          isFaceDetect = true
          let size = 215
    
          result.x = dets[i][1] + dets[i][2]
          result.y = dets[i][0] - dets[i][2] < 0? 0: dets[i][0] - dets[i][2]
          result.w = size
          result.h = size /429 * 800
        }else{
          isFaceDetect = false
        }
      }    
    }
    countNum++
    if(countNum >= intervalFrameNum){
      countNum = 0
    }

    ctx.globalAlpha = isFaceDetect? 0.7: 0.2
    ctx.drawImage(ghostImg, result.x, result.y, result.w, result.h)


    // RGBA image to grayscale
    function rgba_to_grayscale(rgba, nrows, ncols){
      let gray = new Uint8Array(nrows * ncols)
      for(let r = 0; r < nrows; ++r){
        for(let c = 0; c < ncols; ++c){
          // gray = 0.2 * red + 0.7 * green + 0.1 * blue
          gray[r * ncols + c] = ( 2 * rgba[r * 4 * ncols + 4 * c + 0] + 7 * rgba[r * 4 * ncols + 4 * c + 1] + 1 * rgba[r * 4 * ncols + 4 * c + 2] )/10
        }
      }
      return gray
    }


  }



})()