import * as PIXI from 'pixi.js';
import aruco from './aruco/index.js';
import AR from './aruco/index.js';
import GreyscaleImage from './aruco/GreyscaleImage';

let canStreamMarkers = false;

const MESSAGE_TYPES = {
  SET_HOST: 'SET_HOST',
  MARKER_DATA: 'MARKER_DATA',
  VIDEO_DATA: 'VIDEO_DATA',
  SET_CAMERA_PARAMS: 'SET_CAMERA_PARAMS',
  CONNECT_TO_HOST: 'CONNECT_TO_HOST',
};

let peerID;
let shouldStreamVideo = false;

// const socket = new WebSocket('wss://beholder-server.herokuapp.com');
let canStream = false;

const params = (new URL(document.location)).searchParams;
// const hostID = params.get('host');
// const observerID = params.get('observerID');
let fpsCounter;

// Connection opened
// socket.addEventListener('open', function (event) {
//   canStreamMarkers = true;

//   // console.log(hostID, observerID);
//   const msg = {
//     type: MESSAGE_TYPES.CONNECT_TO_HOST,
//     data: {
//       hostID,
//       observerID,
//     },
//   };
//   socket.send(JSON.stringify(msg));
// });

// Listen for messages
// socket.addEventListener('message', function (event) {
//     const msg = JSON.parse(event.data);
//     // console.log('got some data', msg.type);
//     switch (msg.type) {
//       case MESSAGE_TYPES.SET_CAMERA_PARAMS:
//         AR.setCameraParams(msg.data.params);
//         break;
//       default: break;
//     }
// });

var video, canvas, context, imageData, detector, aspectRatio;
var overlay, overlayCtx;
var debugOverlay, debugGraphics, debugApp, arucoApp;
let app;
  
function onLoad(){
  video = document.getElementById("video");
// canvas = document.getElementById("canvas");
// context = canvas.getContext("2d");
  overlay = document.getElementById("pixi-overlay");
  // debugOverlay = document.getElementById("pixi-overlay");
  // mOverlay = document.getElementById("overlay");
  // overlayCtx = overlay.getContext("2d");
//   fpsCounter = document.querySelector('#fps');

//   canvas.width = window.innerWidth;
//   canvas.height = window.innerHeight;

  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }

  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
      }

      return new Promise(function(resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
  }

  let type = "WebGL"
  if(!PIXI.utils.isWebGLSupported()){
    type = "canvas"
  }

  app = new PIXI.Application({  
    width: 960,         // default: 800
    height: 720,        // default: 600
    antialias: true,    // default: false
    transparent: false, // default: false
    resolution: 1,      // default: 1
    view: document.querySelector('#pixi-overlay')
  });
  // arucoApp = new PIXI.Application({  
  //   width: 480,         // default: 800
  //   height: 360,        // default: 600
  //   antialias: true,    // default: false
  //   transparent: false, // default: false
  //   resolution: 1,      // default: 1
  //   view: document.querySelector('#aruco-app')
  // });
  // debugApp = new PIXI.Application({  
  //   width: 480,         // default: 800
  //   height: 360,        // default: 600
  //   antialias: true,    // default: false
  //   transparent: false, // default: false
  //   resolution: 1,      // default: 1
  //   view: document.querySelector('#debug-overlay')
  // });

  // overlay.appendChild(app.view);

  var texture = PIXI.Texture.from(video);
  var texture2 = PIXI.Texture.from(video);
  var videoSprite = new PIXI.Sprite(texture);
  var greyVideoSprite = new PIXI.Sprite(texture2);
  videoSprite.width = 480;
  videoSprite.height = 360;
  greyVideoSprite.width = 480;
  greyVideoSprite.height = 360;

  const greyScale = `
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    void main(void)
    {
      vec4 color = texture2D(uSampler, vTextureCoord);
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      gl_FragColor = vec4(vec3(gray), 1.0);
    }
  `;

  const boxBlur = `
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;  // Texture that will be blurred by this shader

    const float blurSize = 2.0;
    const float blurDiv = (blurSize * 2.0 + 1.0) * (blurSize * 2.0 + 1.0);
    const float pixelX = 1.0 / 480.0;
    const float pixelY = 1.0 / 360.0;

    void main() {
      float source = texture2D(uSampler, vTextureCoord).r;
      float blurredVal = 0.0;
      for (float x = -blurSize; x <= blurSize; x++) {
        for (float y = -blurSize; y <= blurSize; y++) {
          float neighbor = texture2D(uSampler, vec2(vTextureCoord.x + (pixelX * x), vTextureCoord.y + (pixelY * y))).r;
          blurredVal += neighbor;
        }
      }

      blurredVal = blurredVal / blurDiv;  
      blurredVal = (source - blurredVal < -0.035) ? 1.0 : 0.0;
      // blurredVal = texture2D(uSampler, vec2(vTextureCoord.x + (pixelX * 30.0), vTextureCoord.y + (pixelY * 30.0))).r;

      gl_FragColor = vec4(blurredVal, blurredVal, blurredVal, 1.0);
    }`;

  // 2 7 
  // kernal, threshold ^
  // i <= threshold? 0: 255;
  const threshold = `
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    void main(void)
    {
      // vec4 color = texture2D(uSampler, vTextureCoord);
      // float thres = color.r > 0.6 ? 1.0 : 0.0;
      // gl_FragColor = vec4(thres, thres, thres, 1.0);
    }
  `;


  const greyFilter = new PIXI.Filter('', greyScale, {});
  const boxBlurFilter = new PIXI.Filter('', boxBlur, {});
  const thresholdFilter = new PIXI.Filter('', threshold, {});

  videoSprite.filters = [greyFilter, boxBlurFilter];
  greyVideoSprite.filters = [greyFilter];

  //sprite to canvas
  app.stage.addChild(videoSprite);
  videoSprite.position.x = 480;
  app.stage.addChild(greyVideoSprite);
  debugGraphics = new PIXI.Graphics();
  debugGraphics.position.y = 360;
  app.stage.addChild(debugGraphics);
  
  navigator.mediaDevices
    .getUserMedia({ video: { width: 480, height: 360, facingMode: "environment" } })
    .then(function(stream) {
      if ("srcObject" in video) {
        video.srcObject = stream;
        aspectRatio = stream.getVideoTracks()[0].getSettings().aspectRatio;
      } else {
        video.src = window.URL.createObjectURL(stream);
      }
    })
    .catch(function(err) {
      console.log(err.name + ": " + err.message);
    }
  );

  detector = new aruco.Detector();
  requestAnimationFrame(update);
}

let prevTime = Date.now();
const FRAME_CAP = 1.0 / 35; // Capped frame rate, 1/30 = 30fps
let frameCounter = 0;
let greyFormatImage = new GreyscaleImage(480, 360);
let greyFormatSourceImage = new GreyscaleImage(480, 360);

function update() {
  const currentTime = Date.now();
  const dt = currentTime - prevTime;
  prevTime = currentTime;
  frameCounter += dt / 1000;
  requestAnimationFrame(update);

  // logic for frame capping for future optimizations
  // browsers are already capped at 60
  if (frameCounter >= FRAME_CAP) {
    // fpsCounter.innerHTML = Math.floor(1 / frameCounter);
    frameCounter = 0;
  } else {
    return;
  }

  // if (canvas.width !== video.videoWidth) {
  //   canvas.width = video.videoWidth;
  //   canvas.height = video.videoHeight;
    // mOverlay.width = app.renderer.view.videoWidth;
    // mOverlay.height = app.renderer.view.videoHeight;
  // }

  // if (video.readyState === video.HAVE_ENOUGH_DATA){
    // // Render video frame
    imageData = app.renderer.extract.pixels(app.stage);
    greyFormatImage.sampleFrom(imageData, 480*2, 480, 0);
    greyFormatSourceImage.sampleFrom(imageData, 480*2, 0, 0);

    // overlayCtx.clearRect(0,0, overlay.width, overlay.height);

    var markers = detector.detect(greyFormatImage, greyFormatSourceImage);
    debugGraphics.clear();
    // Draw candidates
    markers.forEach((m) => {
      const c = m.corners;
      debugGraphics.lineStyle(1, 0xffffff);

      debugGraphics.moveTo(c[0].x, c[0].y);
      debugGraphics.lineTo(c[1].x, c[1].y);
      debugGraphics.lineTo(c[2].x, c[2].y);
      debugGraphics.lineTo(c[3].x, c[3].y);
      debugGraphics.lineTo(c[0].x, c[0].y);
      
      debugGraphics.endFill();

    });
    

    // if (canStreamMarkers) {
    //   socket.send(JSON.stringify({
    //     type: MESSAGE_TYPES.MARKER_DATA,
    //     data: { hostID, observerID, markers },
    //   }));
    // }
  // }
}

function drawCorners(ctx, markers){
  ctx.lineWidth = 3;

  markers.forEach((m) => {
    const { center, corners } = m;

    ctx.strokeStyle = "red";
    ctx.beginPath();

    corners.forEach((c, i) => {
      ctx.moveTo(c.x, c.y);
      c2 = corners[(I + 1) % corners.length];
      ctx.lineTo(c2.x, c2.y);
    });

    ctx.stroke();
    ctx.closePath();

    // draw first corner
    ctx.strokeStyle = "green";
    ctx.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);

    ctx.strokeStyle = "yellow";
    ctx.strokeRect(center.x - 2, center.y - 2, 4, 4);
  });
}

function drawId(markers){
  var corners, corner, x, y, i, j;

  overlayCtx.strokeStyle = "blue";
  overlayCtx.lineWidth = 1;

  for (i = 0; i !== markers.length; ++ i){
    corners = markers[i].corners;

    x = Infinity;
    y = Infinity;

    for (j = 0; j !== corners.length; ++ j){
      corner = corners[j];

      x = Math.min(x, corner.x);
      y = Math.min(y, corner.y);
    }

    overlayCtx.strokeText(markers[i].id, x, y)
  }
}

window.onload = onLoad;

// service worker businus
// if('serviceWorker' in navigator) {
//   // console.log('doin service');
//   navigator.serviceWorker.register('./sw.js');
// };
