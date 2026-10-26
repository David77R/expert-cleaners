import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/login-screen";

export const metadata: Metadata = { title: "Company Solutions · Iniciar sesión" };

export const viewport: Viewport = { themeColor: "#070b14" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
