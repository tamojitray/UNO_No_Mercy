import { io } from 'socket.io-client';

// 'autoConnect: false' prevents it from connecting before we need to.
// We'll point it to the Flask backend running on port 8000.
const URL = import.meta.env.PROD 
  ? window.location.origin 
  : window.location.protocol + "//" + window.location.hostname + ":8000";

export const socket = io(URL, {
  autoConnect: true, 
  cors: {
    origin: "*"
  }
});
