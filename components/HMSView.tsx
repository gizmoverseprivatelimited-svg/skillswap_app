import React from 'react';

export default function HMSView({ 
  roomCode, 
  userName, 
  onLeave,
  authToken,
  isTeacher
}: { 
  roomCode: string; 
  userName: string; 
  onLeave: () => void;
  authToken?: string;
  isTeacher?: boolean;
}) {
  return null;
}
