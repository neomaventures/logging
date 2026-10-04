import { Controller, Get, HttpCode } from "@nestjs/common"

import { ApplicationLogger } from "@neomaventures/logging"

@Controller()
export class ApplicationController {
  public constructor(public logger: ApplicationLogger) {}

  @Get("/status")
  @HttpCode(204)
  public getStatus(): void {}
}
