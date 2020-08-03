import * as PIXI from 'pixi.js';
import aruco from './aruco/index.js';
import AR from './aruco/index.js';

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
  
function onLoad(){
  video = document.getElementById("video");
//   canvas = document.getElementById("canvas");
//   context = canvas.getContext("2d");
  overlay = document.getElementById("pixi-overlay");
//   overlayCtx = overlay.getContext("2d");
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

  let app = new PIXI.Application({  
    width: 480,         // default: 800
    height: 360,        // default: 600
    antialias: true,    // default: false
    transparent: false, // default: false
    resolution: 1,      // default: 1
    view: document.querySelector('#pixi-overlay')
  });

  // overlay.appendChild(app.view);

  var texture = PIXI.Texture.from(video);
  var videoSprite = new PIXI.Sprite(texture);
  videoSprite.width = app.renderer.width;
  videoSprite.height = app.renderer.height;

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

  // src: http://callumhay.blogspot.com/2010/09/gaussian-blur-shader-glsl.html
  const blurShader = `
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;  // Texture that will be blurred by this shader

  const float sigma = 2.0;     // The sigma value for the gaussian function: higher value means more blur
                         // A good value for 9x9 is around 3 to 5
                         // A good value for 7x7 is around 2.5 to 4
                         // A good value for 5x5 is around 2 to 3.5
                         // ... play around with this based on what you need :)

const float blurSize = 1.0 / 480.0;  // This should usually be equal to
                         // 1.0f / texture_pixel_width for a horizontal blur, and
                         // 1.0f / texture_pixel_height for a vertical blur.

const float pi = 3.14159265;

// The following are all mutually exclusive macros for various 
// seperable blurs of varying kernel size
// #if defined(VERTICAL_BLUR_9)
// const float numBlurPixelsPerSide = 4.0;
// const vec2  blurMultiplyVec      = vec2(0.0, 1.0);
// #elif defined(HORIZONTAL_BLUR_9)
// const float numBlurPixelsPerSide = 4.0;
// const vec2  blurMultiplyVec      = vec2(1.0, 0.0);
// #elif defined(VERTICAL_BLUR_7)
// const float numBlurPixelsPerSide = 3.0;
// const vec2  blurMultiplyVec      = vec2(0.0, 1.0);
// #elif defined(HORIZONTAL_BLUR_7)
// const float numBlurPixelsPerSide = 3.0;
// const vec2  blurMultiplyVec      = vec2(1.0, 0.0);
// #elif defined(VERTICAL_BLUR_5)
// const float numBlurPixelsPerSide = 2.0;
// const vec2  blurMultiplyVec      = vec2(0.0, 1.0);
// #elif defined(HORIZONTAL_BLUR_5)
// const float numBlurPixelsPerSide = 2.0;
// const vec2  blurMultiplyVec      = vec2(1.0, 0.0);
// #else
// // This only exists to get this shader to compile when no macros are defined
// const float numBlurPixelsPerSide = 2.0;
// const vec2  blurMultiplyVec      = vec2(1.0, 0.0);
// #endif

const float numBlurPixelsPerSide = 20.0;
const vec2  blurMultiplyVec      = vec2(0.0, 1.0);

void main() {

  // Incremental Gaussian Coefficent Calculation (See GPU Gems 3 pp. 877 - 889)
  vec3 incrementalGaussian;
  incrementalGaussian.x = 1.0 / (sqrt(2.0 * pi) * sigma);
  incrementalGaussian.y = exp(-0.5 / (sigma * sigma));
  incrementalGaussian.z = incrementalGaussian.y * incrementalGaussian.y;

  vec4 avgValue = vec4(0.0, 0.0, 0.0, 0.0);
  float coefficientSum = 0.0;

  // Take the central sample first...
  avgValue += texture2D(uSampler, vTextureCoord) * incrementalGaussian.x;
  coefficientSum += incrementalGaussian.x;
  incrementalGaussian.xy *= incrementalGaussian.yz;

  // Go through the remaining 8 vertical samples (4 on each side of the center)
  for (float i = 1.0; i <= numBlurPixelsPerSide; i++) { 
    avgValue += texture2D(uSampler, vTextureCoord - i * blurSize * 
                          blurMultiplyVec) * incrementalGaussian.x;         
    avgValue += texture2D(uSampler, vTextureCoord + i * blurSize * 
                          blurMultiplyVec) * incrementalGaussian.x;     
    coefficientSum += 2.0 * incrementalGaussian.x;
    incrementalGaussian.xy *= incrementalGaussian.yz;
  }

  gl_FragColor = avgValue / coefficientSum;
}
  `;

  const greyFilter = new PIXI.Filter('', greyScale, {});
  const blurFilter = new PIXI.Filter('', blurShader, {});
console.log('wat');
  videoSprite.filters = [greyFilter, blurFilter];

  //sprite to canvas
  app.stage.addChild(videoSprite);
  
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

function update(){
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
  //   overlay.width = video.videoWidth;
  //   overlay.height = video.videoHeight;
  // }

  // if (video.readyState === video.HAVE_ENOUGH_DATA){
    // // Render video frame
    // context.drawImage(video, 0, 0, canvas.width, canvas.height);
    // imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // overlayCtx.clearRect(0,0, overlay.width, overlay.height);

    // var markers = detector.detect(imageData);

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
