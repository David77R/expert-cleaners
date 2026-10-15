import { test, expect, type Locator, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.beforeEach(() => {
  test.skip(
    !EMAIL || !PASSWORD,
    "Define E2E_EMAIL y E2E_PASSWORD en .env.local con un usuario real de Supabase Auth para correr las pruebas E2E.",
  );
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(EMAIL!);
  await page.getByLabel("Contraseña").fill(PASSWORD!);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/calendar");
}

function localToday() {
  return new Date().toLocaleDateString("en-CA");
}

async function createSofaAppointment(
  page: Page,
  { technician, seats, time }: { technician: string; seats: string; time: string },
) {
  await page.goto("/appointments/new");

  await page.getByPlaceholder("Buscar por nombre, teléfono o código").fill("Molina");
  await page.getByText("Andrés Molina").click();

  await page.getByRole("button", { name: /Agregar Limpieza de Sofás/ }).click();
  await page.getByLabel("Tipo de sofá").selectOption("Tela");
  await page.getByLabel("Número de asientos").fill(seats);

  await page.locator("label", { hasText: technician }).click();

  await page.getByLabel("Fecha").click();
  await page.getByRole("button", { name: localToday(), exact: true }).click();
  const [hours, minutes] = time.split(":").map(Number);
  await page.getByLabel("Hora de inicio").selectOption(String(hours % 12 === 0 ? 12 : hours % 12));
  await page.getByLabel("Minutos").first().selectOption(String(minutes).padStart(2, "0"));
  await page
    .getByRole("group", { name: "AM o PM" })
    .first()
    .getByRole("button", { name: hours >= 12 ? "PM" : "AM" })
    .click();

  await page.getByRole("button", { name: "Crear cita" }).click();
  await expect(page).toHaveURL(/\/calendar\?.*appt=/, { timeout: 15_000 });

  const panel = page.getByRole("complementary", { name: /^Cita / });
  await expect(panel).toBeVisible();
  return panel;
}

function cancelBox(panel: Locator) {
  return panel.locator("details", { has: panel.page().locator("summary", { hasText: "Cancelar cita" }) });
}

async function cancelWith(panel: Locator, reason: string) {
  const box = cancelBox(panel);
  await box.locator("summary").click();
  await box.getByRole("combobox").selectOption({ label: reason });
  await box.getByRole("button", { name: "Cancelar cita" }).click();
}

test("inicia sesión y ve el día con los técnicos sembrados", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Carlos Betancourt").first()).toBeVisible();
  await expect(page.getByText("Yolanda Hernández").first()).toBeVisible();
  await expect(page.getByText("Osvaldo Reyes").first()).toBeVisible();
});

test("crea una cita, queda en el historial y se cancela con motivo", async ({ page }) => {
  await login(page);
  const panel = await createSofaAppointment(page, {
    technician: "Carlos Betancourt",
    seats: "3",
    time: "09:00",
  });

  await expect(panel.getByText("Historial")).toBeVisible();
  await expect(panel.getByText("Cita creada")).toBeVisible();

  await cancelWith(panel, "Clima");

  await expect(panel.getByText("Cancelada: Clima")).toBeVisible();
});

test("cancelar con 'Otro motivo' sin explicación no cancela la cita", async ({ page }) => {
  await login(page);
  const panel = await createSofaAppointment(page, {
    technician: "Yolanda Hernández",
    seats: "2",
    time: "11:00",
  });

  await cancelWith(panel, "Otro motivo");

  await expect(cancelBox(panel).getByRole("alert")).toBeVisible();
  await expect(panel.getByText(/^Cancelada:/)).not.toBeVisible();

  await cancelBox(panel).getByRole("combobox").selectOption({ label: "Clima" });
  await cancelBox(panel).getByRole("button", { name: "Cancelar cita" }).click();
  await expect(panel.getByText("Cancelada: Clima")).toBeVisible();
});
