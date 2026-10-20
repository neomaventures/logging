import { faker } from "@faker-js/faker"
import { express } from "@neomaventures/mocks"

import {
  type SerializableResponse,
  serializeResponse,
} from "./response.serializer"

const response = (
  headers: Record<string, string> = {},
  statusCode = faker.internet.httpStatusCode(),
): SerializableResponse => ({
  ...express.response({ headers }),
  statusCode,
})

describe("serializeResponse()", () => {
  it("should include the status code", () => {
    const statusCode = faker.internet.httpStatusCode()

    expect(serializeResponse(response({}, statusCode))).toMatchObject({
      statusCode,
    })
  })

  describe("headers", () => {
    const allowed = {
      "content-type": "text/html; charset=utf-8",
      "content-length": "1024",
    }

    it("should include the allow-listed headers", () => {
      expect(serializeResponse(response(allowed)).headers).toEqual(allowed)
    })

    it("should exclude headers that are not allow-listed", () => {
      expect(
        serializeResponse(
          response({
            ...allowed,
            "set-cookie": `sid=${faker.string.alphanumeric(32)}`,
            [`x-${faker.lorem.word()}`]: faker.lorem.word(),
          }),
        ).headers,
      ).toEqual(allowed)
    })

    it("should omit allow-listed headers that are not present", () => {
      expect(serializeResponse(response()).headers).toEqual({})
    })
  })
})
