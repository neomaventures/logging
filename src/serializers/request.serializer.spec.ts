import { faker } from "@faker-js/faker"
import { express } from "@neomaventures/mocks"

import {
  type SerializableRequest,
  serializeRequest,
} from "./request.serializer"

const request = (
  overrides: Partial<SerializableRequest> & { path?: string } = {},
): SerializableRequest => ({ ...express.request(), ...overrides })

describe("serializeRequest()", () => {
  it("should include the request method", () => {
    const method = faker.internet.httpMethod()

    expect(serializeRequest(request({ method }))).toMatchObject({ method })
  })

  it("should include the ip", () => {
    const ip = faker.internet.ip()

    expect(serializeRequest(request({ ip }))).toMatchObject({ ip })
  })

  describe("path", () => {
    it("should be the original url without the query string", () => {
      const path = `/${faker.lorem.slug()}/${faker.string.uuid()}`

      expect(
        serializeRequest(
          request({
            originalUrl: `${path}?code=${faker.string.alphanumeric()}`,
          }),
        ),
      ).toMatchObject({ path })
    })

    it("should use the original url rather than the mount-relative path", () => {
      const originalUrl = `/${faker.lorem.slug()}/${faker.string.uuid()}`

      expect(
        serializeRequest(request({ originalUrl, path: "/" })),
      ).toMatchObject({ path: originalUrl })
    })

    it("should fall back to the url when there is no original url", () => {
      const path = `/${faker.lorem.slug()}`

      expect(
        serializeRequest(
          request({ originalUrl: undefined, url: `${path}?a=1` }),
        ),
      ).toMatchObject({ path })
    })
  })

  describe("route", () => {
    it("should be the matched route pattern once routing has happened", () => {
      const route = `/${faker.lorem.slug()}/:id`

      expect(
        serializeRequest(request({ route: { path: route } })),
      ).toMatchObject({ route })
    })

    it("should be omitted before routing has happened", () => {
      expect(serializeRequest(request())).not.toHaveProperty("route")
    })
  })

  describe("headers", () => {
    const allowed = {
      accept: "text/html",
      "content-type": "application/json",
      "content-length": "42",
      "user-agent": faker.internet.userAgent(),
      "x-request-id": faker.string.uuid(),
    }

    it("should include the allow-listed headers", () => {
      expect(serializeRequest(request({ headers: allowed })).headers).toEqual(
        allowed,
      )
    })

    it("should exclude headers that are not allow-listed", () => {
      const { headers } = serializeRequest(
        request({
          headers: {
            ...allowed,
            cookie: `sid=${faker.string.alphanumeric(32)}`,
            authorization: `Bearer ${faker.string.alphanumeric(32)}`,
            [`x-${faker.lorem.word()}`]: faker.lorem.word(),
          },
        }),
      )

      expect(headers).toEqual(allowed)
    })

    it("should omit allow-listed headers that are not present", () => {
      expect(
        serializeRequest(request({ headers: { accept: "text/html" } })).headers,
      ).toEqual({ accept: "text/html" })
    })
  })
})
