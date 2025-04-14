import io from 'socket.io-client';

const SOCKET_URL = "https://inequality-web-api.onrender.com";

let socket = null;

export const initializeSocket = (token) => {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: {
      token
    },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  return socket;
};

export const getSocket = () => socket;

export const closeSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
};

export default {
  initializeSocket,
  getSocket,
  closeSocket
};