import { randomUUID } from "node:crypto";
import { DomainError } from "@/domain/appointment-rules";
import type { AuthAccount, UserAdmin } from "@/server/user-admin";

export type FakeUserAdmin = UserAdmin & {
  accounts: Map<string, AuthAccount & { password: string; name: string }>;
};

export function createFakeUserAdmin(): FakeUserAdmin {
  const accounts = new Map<string, AuthAccount & { password: string; name: string }>();
  const assertFreeEmail = (email: string, exceptId?: string) => {
    for (const account of accounts.values()) {
      if (account.email === email && account.id !== exceptId) {
        throw new DomainError("email_taken", "Ya existe una cuenta con ese correo");
      }
    }
  };
  return {
    accounts,
    async createUser({ email, password, name }) {
      assertFreeEmail(email);
      const account = { id: randomUUID(), email, password, name, banned: false };
      accounts.set(account.id, account);
      return { id: account.id, email, banned: false };
    },
    async updateUser(id, changes) {
      const account = accounts.get(id);
      if (!account) throw new DomainError("auth_error", "No existe");
      if (changes.email) assertFreeEmail(changes.email, id);
      Object.assign(account, Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)));
    },
    async setBanned(id, banned) {
      const account = accounts.get(id);
      if (account) account.banned = banned;
    },
    async deleteUser(id) {
      accounts.delete(id);
    },
    async listUsers() {
      return [...accounts.values()].map(({ id, email, banned }) => ({ id, email, banned }));
    },
  };
}
