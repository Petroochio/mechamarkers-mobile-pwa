import aruco from './aruco/index.js';

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
    .getUserMedia({ video: { facingMode: "environment" } })
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

function update(){
  requestAnimationFrame(update);
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
    drawCorners(markers);
    drawId(markers);
  }
}

function drawCorners(markers){
  var corners, corner, i, j;

  overlayCtx.lineWidth = 3;

  for (i = 0; i !== markers.length; ++ i){
    corners = markers[i].corners;
    const center = markers[i].center;

    overlayCtx.strokeStyle = "red";
    overlayCtx.beginPath();

    for (j = 0; j !== corners.length; ++ j){
      corner = corners[j];
      overlayCtx.moveTo(corner.x, corner.y);
      corner = corners[(j + 1) % corners.length];
      overlayCtx.lineTo(corner.x, corner.y);
    }

    overlayCtx.stroke();
    overlayCtx.closePath();

    overlayCtx.strokeStyle = "green";
    overlayCtx.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);

    overlayCtx.strokeStyle = "yellow";
    overlayCtx.strokeRect(center.x - 2, center.y - 2, 4, 4);
  }
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
