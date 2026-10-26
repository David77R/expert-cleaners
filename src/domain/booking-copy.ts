import type { VehicleSize } from "./vehicles";

export type BookingCopy = {
  title: string;
  subtitle: string;
  stepPackage: string;
  stepVehicle: string;
  stepWhen: string;
  stepWhere: string;
  stepContact: string;
  from: string;
  minutes: (value: number) => string;
  sizes: Record<VehicleSize, string>;
  make: string;
  model: string;
  color: string;
  pickDay: string;
  closed: string;
  loadingTimes: string;
  noTimes: string;
  street: string;
  unit: string;
  city: string;
  zip: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  notesHint: string;
  optional: string;
  total: string;
  submit: string;
  sending: string;
  missing: string;
  successTitle: string;
  successBody: (code: string) => string;
  another: string;
  errors: Record<string, string>;
  locale: string;
};

export const BOOKING_COPY: Record<"es" | "en", BookingCopy> = {
  en: {
    title: "Book your service",
    subtitle: "Pick your package, your car and a time. We come to you.",
    stepPackage: "Choose your package",
    stepVehicle: "Your vehicle",
    stepWhen: "Day and time",
    stepWhere: "Where should we go?",
    stepContact: "Your contact info",
    from: "from",
    minutes: (value) =>
      value >= 60 ? `${Math.floor(value / 60)} h${value % 60 ? ` ${value % 60} min` : ""}` : `${value} min`,
    sizes: { sedan: "Sedan / Coupe", suv: "SUV", pickup: "Pickup truck", van: "Van / Minivan", other: "Other" },
    make: "Make",
    model: "Model",
    color: "Color",
    pickDay: "Pick a day to see the available times.",
    closed: "Closed",
    loadingTimes: "Looking for available times…",
    noTimes: "No times left that day. Try another day.",
    street: "Street address",
    unit: "Apt / Suite",
    city: "City",
    zip: "ZIP code",
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone",
    email: "Email",
    notes: "Anything we should know?",
    notesHint: "Gate code, parking, pet hair, stains…",
    optional: "optional",
    total: "Estimated total",
    submit: "Book now",
    sending: "Booking…",
    missing: "Please complete the highlighted fields.",
    successTitle: "You're booked!",
    successBody: (code) => `Your booking number is ${code}. We'll contact you shortly to confirm your appointment.`,
    another: "Book another service",
    errors: {
      slot_taken: "That time was just taken. Please choose another one.",
      too_many_bookings: "You already have several upcoming bookings. Please contact us for a new one.",
      service_unavailable: "That package is not available right now.",
      validation_error: "Please check your information and try again.",
      rate_limited: "Too many attempts. Please wait a few minutes and try again.",
      default: "We couldn't complete your booking. Please try again.",
    },
    locale: "en-US",
  },
  es: {
    title: "Reserva tu servicio",
    subtitle: "Elige el paquete, tu vehículo y la hora. Nosotros vamos a ti.",
    stepPackage: "Elige tu paquete",
    stepVehicle: "Tu vehículo",
    stepWhen: "Día y hora",
    stepWhere: "¿A dónde vamos?",
    stepContact: "Tus datos de contacto",
    from: "desde",
    minutes: (value) =>
      value >= 60 ? `${Math.floor(value / 60)} h${value % 60 ? ` ${value % 60} min` : ""}` : `${value} min`,
    sizes: { sedan: "Sedán / coupé", suv: "SUV", pickup: "Pickup", van: "Van / minivan", other: "Otro" },
    make: "Marca",
    model: "Modelo",
    color: "Color",
    pickDay: "Elige un día para ver las horas disponibles.",
    closed: "Cerrado",
    loadingTimes: "Buscando horas disponibles…",
    noTimes: "Ya no quedan horas ese día. Prueba con otro.",
    street: "Calle y número",
    unit: "Apartamento",
    city: "Ciudad",
    zip: "Código postal",
    firstName: "Nombre",
    lastName: "Apellido",
    phone: "Teléfono",
    email: "Correo",
    notes: "¿Algo que debamos saber?",
    notesHint: "Código del portón, estacionamiento, pelos de mascota, manchas…",
    optional: "opcional",
    total: "Total estimado",
    submit: "Reservar",
    sending: "Reservando…",
    missing: "Completa los campos marcados.",
    successTitle: "¡Reserva recibida!",
    successBody: (code) => `Tu número de reserva es ${code}. Te contactaremos pronto para confirmar la cita.`,
    another: "Reservar otro servicio",
    errors: {
      slot_taken: "Esa hora se acaba de ocupar. Elige otra, por favor.",
      too_many_bookings: "Ya tienes varias reservas pendientes. Escríbenos para ayudarte con una nueva.",
      service_unavailable: "Ese paquete no está disponible ahora.",
      validation_error: "Revisa tus datos e inténtalo de nuevo.",
      rate_limited: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
      default: "No pudimos completar tu reserva. Inténtalo de nuevo.",
    },
    locale: "es-US",
  },
};
