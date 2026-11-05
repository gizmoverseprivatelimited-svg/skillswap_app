const { Server } = require('socket.io');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    socket.on('join_room', (userId) => {
      if (userId) {
        const roomName = `user_${userId}`;
        socket.join(roomName);
        console.log(`[Socket.IO] Socket ${socket.id} joined room: ${roomName}`);
      }
    });

    socket.on('leave_room', (userId) => {
      if (userId) {
        const roomName = `user_${userId}`;
        socket.leave(roomName);
        console.log(`[Socket.IO] Socket ${socket.id} left room: ${roomName}`);
      }
    });

    socket.on('swap_call_started', (data) => {
      console.log('[Socket.IO] swap_call_started received on server:', data);
      if (data) {
        const rawIds = [data.partnerId, data.recipientId, data.to, data.targetId];
        const extractedIds = rawIds
          .map(item => (typeof item === 'object' && item !== null ? (item._id || item.id) : item))
          .filter(Boolean)
          .map(String)
          .filter(id => id !== 'partner-id' && id !== 'partner' && id !== '[object Object]');
        const uniqueUserIds = [...new Set(extractedIds)];

        const payload = {
          swapId: data.swapId,
          callerId: data.callerId,
          callerName: data.callerName || 'Your partner',
          mode: data.mode || 'video',
          title: `Incoming ${data.mode === 'voice' ? 'Voice' : 'Video'} Call`,
          body: `${data.callerName || 'Your partner'} started the call. Tap to join!`,
          metadata: { swapId: data.swapId, type: 'video-call', mode: data.mode || 'video' },
          createdAt: new Date().toISOString(),
        };

        uniqueUserIds.forEach((uid) => {
          io.to(`user_${uid}`).emit('incoming_call', payload);
          console.log(`[Socket.IO] Forwarded incoming_call to user_${uid}`);
        });
      }
    });

    socket.on('class_call_started', (data) => {
      console.log('[Socket.IO] class_call_started received on server:', data);
      if (data && data.classId) {
        const studentIds = Array.isArray(data.studentIds) ? data.studentIds : [];
        const payload = {
          swapId: data.classId,
          callerId: data.callerId,
          callerName: data.callerName || 'Teacher',
          mode: data.mode || 'video',
          title: `🔴 Live Class: ${data.classTitle || 'Group Class'}`,
          body: `${data.callerName || 'Teacher'} started the live class. Tap to join!`,
          metadata: {
            swapId: data.classId,
            classId: data.classId,
            type: 'class-video-call',
            mode: data.mode || 'video',
            isClass: true,
            callerId: data.callerId,
            callerName: data.callerName || 'Teacher',
          },
          createdAt: new Date().toISOString(),
        };

        studentIds.forEach((uid) => {
          if (uid) {
            io.to(`user_${String(uid)}`).emit('incoming_call', payload);
            console.log(`[Socket.IO] Forwarded class incoming_call to student user_${uid}`);
          }
        });

        socket.to(`room_${String(data.classId)}`).emit('class_started', data);
      }
    });

    socket.on('join_call_room', (data) => {
      if (data && data.room) {
        const roomName = `room_${String(data.room)}`;
        socket.join(roomName);
        console.log(`[Socket.IO] Socket ${socket.id} joined call room: ${roomName}`);
      }
    });

    socket.on('call_signal', (data) => {
      console.log('[Socket.IO] call_signal received on server:', data?.type, 'for room:', data?.room);
      if (data?.room) {
        socket.to(`room_${String(data.room)}`).emit('call_signal', data);
      }
      const targetUser = data?.to || data?.targetId;
      if (targetUser && targetUser !== 'undefined') {
        io.to(`user_${String(targetUser)}`).emit('call_signal', data);
      }
    });

    socket.on('signal', (data) => {
      if (data?.room) {
        socket.to(`room_${String(data.room)}`).emit('call_signal', data);
      }
      const targetUser = data?.to || data?.targetId;
      if (targetUser && targetUser !== 'undefined') {
        io.to(`user_${String(targetUser)}`).emit('call_signal', data);
      }
    });

    socket.on('call_peer_joined', (data) => {
      console.log('[Socket.IO] call_peer_joined received:', data);
      if (data?.room) {
        socket.to(`room_${String(data.room)}`).emit('call_peer_joined', data);
      }
      const targetUser = data?.targetId || data?.to || data?.partnerId;
      if (targetUser) {
        io.to(`user_${String(targetUser)}`).emit('call_peer_joined', data);
      }
    });

    socket.on('call_peer_present', (data) => {
      console.log('[Socket.IO] call_peer_present received:', data);
      if (data?.to) {
        io.to(`user_${String(data.to)}`).emit('call_peer_present', data);
      } else if (data?.room) {
        socket.to(`room_${String(data.room)}`).emit('call_peer_present', data);
      }
    });

    socket.on('call_peer_left', (data) => {
      console.log('[Socket.IO] call_peer_left received:', data);
      if (data?.room) {
        socket.to(`room_${String(data.room)}`).emit('call_peer_left', data);
      }
      const targetUser = data?.targetId || data?.to || data?.partnerId;
      if (targetUser) {
        io.to(`user_${String(targetUser)}`).emit('call_peer_left', data);
      }
    });

    socket.on('call_reaction', (data) => {
      const targetUser = data?.to || data?.targetId || data?.partnerId;
      if (targetUser) {
        io.to(`user_${String(targetUser)}`).emit('call_reaction', data);
      }
      if (data?.room) {
        socket.to(`room_${String(data.room)}`).emit('call_reaction', data);
      }
    });

    socket.on('call_chat_message', (data) => {
      if (data?.room) {
        socket.to(`room_${String(data.room)}`).emit('call_chat_message', data);
      } else {
        const targetUser = data?.to || data?.targetId;
        if (targetUser) {
          io.to(`user_${String(targetUser)}`).emit('call_chat_message', data);
        }
      }
    });

    socket.on('call_ended', (data) => {
      console.log('[Socket.IO] call_ended received on server:', data);
      if (data?.room || data?.swapId) {
        const roomName = String(data.room || data.swapId);
        socket.to(`room_${roomName}`).emit('call_ended', data);
      }
      const targetUser = data?.to || data?.targetId || data?.partnerId;
      if (targetUser) {
        io.to(`user_${String(targetUser)}`).emit('call_ended', data);
      }
    });

    socket.on('send_notification', (data) => {
      if (data && data.userId) {
        io.to(`user_${String(data.userId)}`).emit('new_notification', data);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitToUser(userId, event, data) {
  if (io && userId) {
    io.to(`user_${String(userId)}`).emit(event, data);
  }
}

function broadcastEvent(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  broadcastEvent,
};
