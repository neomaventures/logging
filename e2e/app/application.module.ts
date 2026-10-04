import { Module } from "@nestjs/common"

import { LoggingModule } from "@neomaventures/logging"

import { ApplicationController } from "./application.controller"

@Module({
  imports: [LoggingModule.forRoot()],
  controllers: [ApplicationController],
})
export class ApplicationModule {}
