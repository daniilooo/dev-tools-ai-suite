import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { AuthService } from "./auth.service";

const session = { authenticated: true, csrfToken: "csrf-123", expiresAt: "2030-01-01T00:00:00.000Z" };

function fakeLocation(hash: string): Location {
  return { hash, pathname: "/", search: "" } as Location;
}

describe("AuthService", () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let replaced: string | null;
  const history = {
    replaceState: (_d: unknown, _t: string, url: string) => (replaced = url),
  } as unknown as History;

  beforeEach(() => {
    replaced = null;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("troca o código do fragmento e remove-o da barra de endereço", async () => {
    const done = auth.init(fakeLocation("#code=abc"), history);
    expect(replaced).toBe("/");
    const request = http.expectOne("/api/v1/session/exchange");
    expect(request.request.body).toEqual({ code: "abc" });
    request.flush(session);
    await done;
    expect(auth.state()).toBe("authenticated");
    expect(auth.csrfToken).toBe("csrf-123");
  });

  it("sem código, consulta a sessão existente", async () => {
    const done = auth.init(fakeLocation(""), history);
    http.expectOne("/api/v1/session").flush(session);
    await done;
    expect(auth.state()).toBe("authenticated");
    expect(replaced).toBeNull();
  });

  it("fica anônimo quando não há sessão", async () => {
    const done = auth.init(fakeLocation(""), history);
    http
      .expectOne("/api/v1/session")
      .flush({ error: { code: "UNAUTHORIZED" } }, { status: 401, statusText: "Unauthorized" });
    await done;
    expect(auth.state()).toBe("anonymous");
    expect(auth.csrfToken).toBeNull();
  });
});
