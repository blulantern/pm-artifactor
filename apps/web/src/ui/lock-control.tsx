"use client";

import { lockVault } from "@/app/vault/actions";

export function LockControl() {
  return (
    <form action={lockVault}>
      <button className="ghost" type="submit">
        ⏻ Lock / Log out
      </button>
    </form>
  );
}
