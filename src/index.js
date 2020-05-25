import Peer from 'peerjs';
import aruco from './aruco/index.js';

let canStreamMarkers = false;
let host;

const MESSAGE_TYPES = {
  SET_HOST: 'SET_HOST',
  MARKER_DATA: 'MARKER_DATA',
  VIDEO_DATA: 'VIDEO_DATA',
};
const peer = new Peer('beholder-client', {
  secure: true,
  host: 'beholder-server.herokuapp.com',
  path: '/peerapp',
});
peer.on('open', (id) => {
  host = peer.connect('beholder-host');
  host.on('open', (id) => {
    console.log('wat');

    canStreamMarkers = true;
  });
});

let peerID;
let shouldStreamVideo = false;

// const socket = new WebSocket('ws://192.168.0.5:9000');
// let canStream = false;

// // Connection opened
// socket.addEventListener('open', function (event) {
//   canStream = true;
// });

// // Listen for messages
// socket.addEventListener('message', function (event) {
//     console.log('Message from server ', event.data);
// });



var video, canvas, context, imageData, detector, aspectRatio;
var overlay, overlayCtx;
  
function onLoad(){
  video = document.getElementById("video");
  canvas = document.getElementById("canvas");
  context = canvas.getContext("2d");
  overlay = document.getElementById("overlay");
  overlayCtx = overlay.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

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
  
  navigator.mediaDevices
    .getUserMedia({ video: { width: 640, height: 480, facingMode: "environment" } })
    .then(function(stream) {
      console.log('kappa?');
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
const FRAME_CAP = .030; // Capped frame rate
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
    console.log(frameCounter);
    frameCounter = 0;
  } else {
    return;
  }

  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
  }

  if (video.readyState === video.HAVE_ENOUGH_DATA){
    // Render video frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    overlayCtx.clearRect(0,0, overlay.width, overlay.height);

    var markers = detector.detect(imageData);
    // console.log(markers);
    // if (canStreamMarkers) host.send({ type: 'MARKERS', data: markers });
    // if (shouldStreamVideo) host.send({ type: 'VIDEO', data: imageData });

    if (canStreamMarkers) {
      // console.log('stream everything pls');
      const videoData = {
        frame: canvas.toDataURL('image/jpeg'),
        width: canvas.width,
        height: canvas.height,
      }
      host.send({ type: MESSAGE_TYPES.MARKER_DATA, data: markers });
      // host.send({ type: MESSAGE_TYPES.VIDEO_DATA, data: videoData });
    }
    // drawCorners(markers);
    // drawId(markers);
  }
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
if('serviceWorker' in navigator) {
  console.log('doin service');
  navigator.serviceWorker.register('./sw.js');
};
