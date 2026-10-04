import { managedAppInstance } from "@neomaventures/managed-app"
import { HttpStatus } from "@nestjs/common"
import request from "supertest"
import { type App } from "supertest/types"

describe("AppController (e2e)", () => {
  it(`/status (GET) - responds with a HTTP ${HttpStatus.NO_CONTENT}`, async () => {
    const app = await managedAppInstance<App>()
    return request(app.getHttpServer())
      .get("/status")
      .expect(HttpStatus.NO_CONTENT)
  })
})
