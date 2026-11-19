import { describe, expect, it } from "vitest";
import { splitFullAddress } from "@/domain/booking-address";

describe("splitFullAddress", () => {
  it("separa la dirección completa que pega el autocompletado del navegador", () => {
    expect(splitFullAddress("10-18 S 15th St, Richmond, VA 23219, EE. UU.")).toEqual({
      line1: "10-18 S 15th St",
      city: "Richmond",
      state: "VA",
      zip: "23219",
    });
  });

  it("acepta ZIP+4 y espacios de más", () => {
    expect(splitFullAddress("  2100 W Broad St ,  Glen Allen , va  23060-1234 ")).toEqual({
      line1: "2100 W Broad St",
      city: "Glen Allen",
      state: "VA",
      zip: "23060",
    });
  });

  it("deja quieta una calle sola o un texto sin número", () => {
    expect(splitFullAddress("2100 W Broad St")).toBeNull();
    expect(splitFullAddress("Main Street, Richmond, VA 23219")).toBeNull();
  });
});
