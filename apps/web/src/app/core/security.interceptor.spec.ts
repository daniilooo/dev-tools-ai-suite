import { HttpClient, provideHttpClient, withInterceptors } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { AuthService } from "./auth.service";
import { securityInterceptor } from "./security.interceptor";

describe("securityInterceptor", () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([securityInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    const done = auth.exchange("code");
    backend
      .expectOne("/api/v1/session/exchange")
      .flush({ csrfToken: "tok", expiresAt: "", authenticated: true });
    await done;
  });

  it("envia x-csrf-token apenas em métodos com efeito colateral", () => {
    http.get("/api/v1/projects").subscribe();
    expect(backend.expectOne("/api/v1/projects").request.headers.has("x-csrf-token")).toBe(false);
    http.post("/api/v1/projects", {}).subscribe();
    expect(backend.expectOne("/api/v1/projects").request.headers.get("x-csrf-token")).toBe("tok");
  });

  it("em 401 marca a sessão como anônima e vai para /acesso", async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    const call = firstValueFrom(http.get("/api/v1/projects")).catch(() => "erro");
    backend.expectOne("/api/v1/projects").flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await call).toBe("erro");
    expect(auth.state()).toBe("anonymous");
    expect(navigate).toHaveBeenCalledWith("/acesso");
  });
});
