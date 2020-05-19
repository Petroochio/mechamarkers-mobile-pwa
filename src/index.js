window.onload = () => {
  document.querySelector('#temp-random-content').innerHTML = `random number to check js works ${Math.random() * 30}`;
}

// service worker businus
if('serviceWorker' in navigator) {
  console.log('doin service');
  navigator.serviceWorker.register('./sw.js');
};
