import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/domain/appointment-rules";
import { env } from "@/lib/env";

export type AuthAccount = { id: string; email: string; banned: boolean };

export interface UserAdmin {
  createUser(input: { email: string; password: string; name: string }): Promise<AuthAccount>;
  updateUser(id: string, changes: { email?: string; password?: string; name?: string }): Promise<void>;
  setBanned(id: string, banned: boolean): Promise<void>;
  deleteUser(id: string): Promise<void>;
  listUsers(): Promise<AuthAccount[]>;
}

const BAN_FOREVER = "876000h";

function toDomainError(error: { message: string; code?: string; status?: number }): DomainError {
  const text = error.message.toLowerCase();
  if (error.code === "email_exists" || text.includes("already been registered") || text.includes("already exists")) {
    return new DomainError("email_taken", "Ya existe una cuenta con ese correo");
  }
  if (error.code === "weak_password" || text.includes("password")) {
    return new DomainError("weak_password", "La contraseña es muy débil; usa al menos 8 caracteres");
  }
  return new DomainError("auth_error", `No se pudo completar la operación en Supabase Auth: ${error.message}`);
}

function isBanned(bannedUntil: string | null | undefined): boolean {
  return Boolean(bannedUntil) && new Date(bannedUntil as string).getTime() > Date.now();
}

export function createSupabaseUserAdmin(client: SupabaseClient): UserAdmin {
  const admin = () => client.auth.admin;
  return {
    async createUser({ email, password, name }) {
      const { data, error } = await admin().createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error || !data.user) throw toDomainError(error ?? { message: "sin datos" });
      return { id: data.user.id, email: data.user.email ?? email, banned: false };
    },
    async updateUser(id, { email, password, name }) {
      const { error } = await admin().updateUserById(id, {
        ...(email ? { email, email_confirm: true } : {}),
        ...(password ? { password } : {}),
        ...(name ? { user_metadata: { name } } : {}),
      });
      if (error) throw toDomainError(error);
    },
    async setBanned(id, banned) {
      const { error } = await admin().updateUserById(id, { ban_duration: banned ? BAN_FOREVER : "none" });
      if (error) throw toDomainError(error);
    },
    async deleteUser(id) {
      const { error } = await admin().deleteUser(id);
      if (error) throw toDomainError(error);
    },
    async listUsers() {
      const accounts: AuthAccount[] = [];
      for (let page = 1; ; page++) {
        const { data, error } = await admin().listUsers({ page, perPage: 200 });
        if (error) throw toDomainError(error);
        for (const user of data.users) {
          accounts.push({ id: user.id, email: user.email ?? "", banned: isBanned(user.banned_until) });
        }
        if (data.users.length < 200) return accounts;
      }
    },
  };
}

let cached: UserAdmin | undefined;

export function getUserAdmin(): UserAdmin {
  if (!cached) {
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new DomainError("auth_not_configured", "Falta SUPABASE_SERVICE_ROLE_KEY para administrar agentes");
    }
    const client = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cached = createSupabaseUserAdmin(client);
  }
  return cached;
}
