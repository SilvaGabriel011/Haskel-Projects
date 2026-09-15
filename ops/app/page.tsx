import { redirect } from "next/navigation";

import { auth } from "@/auth";

/** There is no landing page here — you are either signed in or at /login. */
export default async function Root() {
  const session = await auth();
  redirect(session?.user ? "/dashboard" : "/login");
}
