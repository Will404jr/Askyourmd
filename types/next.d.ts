import type { NextApiResponse } from "next";
import type { Server as SocketIOServer } from "socket.io";

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: {
      io: SocketIOServer;
    };
  };
};
