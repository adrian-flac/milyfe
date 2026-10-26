import { DefaultSession } from "next-auth";

declare module "@auth/core/types" {
  interface Session {
    user: { id: string; sessionVersion: number } & DefaultSession["user"];
  }

  interface User {
    sessionVersion: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    sessionVersion?: number;
  }
}
