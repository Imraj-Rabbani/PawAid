import { describe, expect, it } from "vitest"
import { prisma } from "../src/db.js"
import { PAWAID_FUND_ID } from "../src/services/fund.services.js"
import {
  balanceOf, checkout, createProduct, createUser, createVolunteer, expectLedgerConsistent, patch, topUp, whileRowLocked,
} from "./helpers.js"

// The marketplace rows of the flow table in Architecture.md: checkout, cancel, deliver

const setOrderStatus = (admin, order, status) =>
  patch(`/admin/orders/${order.id}/status`, { token: admin.token, body: { status } })

const stockOf = async (product) => (await prisma.product.findUnique({ where: { id: product.id } })).stockQty
const orderWithMoney = (order) => prisma.order.findUnique({
  where: { id: order.id },
  include: { payment: true, financialTransaction: true },
})

describe("checkout", () => {
  it("charges the wallet, takes the stock and confirms a wallet order", async () => {
    const buyer = await createUser()
    const product = await createProduct({ sellingPrice: 100, stockQty: 10 })
    await topUp(buyer, 500)

    const res = await checkout(buyer, { items: [{ productId: product.id, quantity: 3 }] })

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ totalAmount: 300, status: "CONFIRMED" })
    expect(await balanceOf(buyer)).toBe(200)
    expect(await stockOf(product)).toBe(7)
    const order = await orderWithMoney(res.body.data)
    expect(order.payment.status).toBe("COMPLETED")
    expect(order.financialTransaction).toMatchObject({ type: "ORDER_PAYMENT", status: "COMPLETED", amount: 300 })
    await expectLedgerConsistent()
  })

  it("prices the order from the database and merges repeated lines", async () => {
    const buyer = await createUser()
    const product = await createProduct({ sellingPrice: 100 })
    await topUp(buyer, 500)

    const res = await checkout(buyer, {
      items: [{ productId: product.id, quantity: 1 }, { productId: product.id, quantity: 2 }],
      // fields the schema doesn't list are dropped, so a client can't set its own price
      unitPrice: 1,
      totalAmount: 1,
    })

    expect(res.status).toBe(201)
    expect(res.body.data.totalAmount).toBe(300)
    expect(res.body.data.items).toHaveLength(1)
    expect(await balanceOf(buyer)).toBe(200)
  })

  it("asks the buyer to confirm again when the price changed since they looked", async () => {
    const buyer = await createUser()
    const product = await createProduct({ sellingPrice: 100 })
    await topUp(buyer, 500)

    const res = await checkout(buyer, { items: [{ productId: product.id, quantity: 1 }], expectedTotal: 80 })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe("CART_CHANGED")
    expect(await balanceOf(buyer)).toBe(500)
  })

  it("rolls everything back when the wallet can't cover it", async () => {
    const buyer = await createUser()
    const product = await createProduct({ sellingPrice: 100, stockQty: 10 })
    await topUp(buyer, 150)

    const res = await checkout(buyer, { items: [{ productId: product.id, quantity: 2 }] })

    expect(res.status).toBe(400)
    expect(await balanceOf(buyer)).toBe(150)
    expect(await stockOf(product)).toBe(10)
    expect(await prisma.order.count()).toBe(0)
    await expectLedgerConsistent()
  })

  it("refuses more than is in stock", async () => {
    const buyer = await createUser()
    const product = await createProduct({ stockQty: 2 })
    await topUp(buyer, 1000)

    const res = await checkout(buyer, { items: [{ productId: product.id, quantity: 3 }] })

    expect(res.status).toBe(409)
    expect(await stockOf(product)).toBe(2)
    expect(await balanceOf(buyer)).toBe(1000)
  })

  it("sells the last unit to only one of two buyers checking out at once", async () => {
    const product = await createProduct({ sellingPrice: 100, stockQty: 1 })
    const buyers = [await createUser(), await createUser()]
    for (const buyer of buyers) await topUp(buyer, 100)

    const responses = await whileRowLocked({ table: "products", id: product.id, waiters: 2 }, () =>
      Promise.all(buyers.map((buyer) => checkout(buyer, { items: [{ productId: product.id, quantity: 1 }] }))),
    )

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await stockOf(product)).toBe(0)
    expect((await balanceOf(buyers[0])) + (await balanceOf(buyers[1]))).toBe(100)
    await expectLedgerConsistent()
  })

  it("won't let a revoked volunteer pay from their wallet", async () => {
    const buyer = await createVolunteer()
    const product = await createProduct({ sellingPrice: 100 })
    await topUp(buyer, 500)
    await prisma.volunteerProfile.update({ where: { id: buyer.volunteer.id }, data: { status: "SUSPENDED" } })

    const res = await checkout(buyer, { items: [{ productId: product.id, quantity: 1 }] })

    expect(res.status).toBe(403)
    expect(await balanceOf(buyer)).toBe(500)
  })

  it("leaves a cash order unpaid and the wallet untouched", async () => {
    const buyer = await createUser()
    const product = await createProduct({ sellingPrice: 100, stockQty: 5 })

    const res = await checkout(buyer, { items: [{ productId: product.id, quantity: 2 }], paymentMethod: "CASH" })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe("PENDING")
    expect(await stockOf(product)).toBe(3)
    const order = await orderWithMoney(res.body.data)
    expect(order.payment.status).toBe("PENDING")
    expect(order.financialTransaction.status).toBe("PENDING")
    expect(await prisma.walletTransaction.count()).toBe(0)
  })
})

describe("cancelling an order", () => {
  it("restocks a wallet order and refunds the buyer", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const buyer = await createUser()
    const product = await createProduct({ sellingPrice: 100, stockQty: 10 })
    await topUp(buyer, 500)
    const { body } = await checkout(buyer, { items: [{ productId: product.id, quantity: 3 }] })

    const res = await setOrderStatus(admin, body.data, "CANCELLED")

    expect(res.status).toBe(200)
    expect(await balanceOf(buyer)).toBe(500)
    expect(await stockOf(product)).toBe(10)
    const order = await orderWithMoney(body.data)
    expect(order.status).toBe("CANCELLED")
    expect(order.payment.status).toBe("REFUNDED")
    const refund = await prisma.financialTransaction.findFirstOrThrow({ where: { type: "REFUND" } })
    expect(refund).toMatchObject({ source: "MARKETPLACE", amount: 300, relatedUserId: buyer.id })
    await expectLedgerConsistent()
  })

  it("restocks a cash order and marks the uncollected payment failed", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const buyer = await createUser()
    const product = await createProduct({ stockQty: 5 })
    const { body } = await checkout(buyer, { items: [{ productId: product.id, quantity: 2 }], paymentMethod: "CASH" })

    const res = await setOrderStatus(admin, body.data, "CANCELLED")

    expect(res.status).toBe(200)
    expect(await stockOf(product)).toBe(5)
    const order = await orderWithMoney(body.data)
    expect(order.payment.status).toBe("FAILED")
    expect(order.financialTransaction.status).toBe("CANCELLED")
    expect(await prisma.financialTransaction.count({ where: { type: "REFUND" } })).toBe(0)
    expect(await balanceOf(buyer)).toBe(0)
  })

  it("refunds only once when two admins cancel at the same moment", async () => {
    const admins = [await createUser({ role: "ADMIN" }), await createUser({ role: "ADMIN" })]
    const buyer = await createUser()
    const product = await createProduct({ sellingPrice: 100, stockQty: 10 })
    await topUp(buyer, 300)
    const { body } = await checkout(buyer, { items: [{ productId: product.id, quantity: 3 }] })

    const responses = await whileRowLocked({ table: "orders", id: body.data.id, waiters: 2 }, () =>
      Promise.all(admins.map((admin) => setOrderStatus(admin, body.data, "CANCELLED"))),
    )

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await balanceOf(buyer)).toBe(300)
    expect(await stockOf(product)).toBe(10)
    await expectLedgerConsistent()
  })

  it("can't cancel a delivered order", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const buyer = await createUser()
    const product = await createProduct()
    await topUp(buyer, 500)
    const { body } = await checkout(buyer, { items: [{ productId: product.id, quantity: 1 }] })
    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
      expect((await setOrderStatus(admin, body.data, status)).status).toBe(200)
    }

    const res = await setOrderStatus(admin, body.data, "CANCELLED")

    expect(res.status).toBe(400)
    expect(await balanceOf(buyer)).toBe(400)
    await expectLedgerConsistent()
  })
})

describe("delivering an order", () => {
  it("collects a cash payment and pays the profit into the PawAid Fund", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const buyer = await createUser()
    const product = await createProduct({ sellingPrice: 100, costPrice: 60 })
    const { body } = await checkout(buyer, { items: [{ productId: product.id, quantity: 3 }], paymentMethod: "CASH" })

    for (const status of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]) {
      expect((await setOrderStatus(admin, body.data, status)).status).toBe(200)
    }

    const order = await orderWithMoney(body.data)
    expect(order.payment.status).toBe("COMPLETED")
    expect(order.financialTransaction.status).toBe("COMPLETED")
    // (100 - 60) x 3
    const fund = await prisma.rescueFund.findUnique({ where: { id: PAWAID_FUND_ID } })
    expect(fund.totalAvailable).toBe(120)
    await expectLedgerConsistent()
  })

  it("uses the cost at the time of sale, not a later edit", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const buyer = await createUser()
    const product = await createProduct({ sellingPrice: 100, costPrice: 60 })
    await topUp(buyer, 100)
    const { body } = await checkout(buyer, { items: [{ productId: product.id, quantity: 1 }] })
    await prisma.product.update({ where: { id: product.id }, data: { costPrice: 90 } })

    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
      await setOrderStatus(admin, body.data, status)
    }

    const fund = await prisma.rescueFund.findUnique({ where: { id: PAWAID_FUND_ID } })
    expect(fund.totalAvailable).toBe(40)
    await expectLedgerConsistent()
  })

  it("adds nothing to the fund for an item sold at or below cost", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const buyer = await createUser()
    const product = await createProduct({ sellingPrice: 50, costPrice: 80 })
    await topUp(buyer, 50)
    const { body } = await checkout(buyer, { items: [{ productId: product.id, quantity: 1 }] })

    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
      await setOrderStatus(admin, body.data, status)
    }

    const fund = await prisma.rescueFund.findUnique({ where: { id: PAWAID_FUND_ID } })
    expect(fund.totalAvailable).toBe(0)
    expect(await prisma.financialTransaction.count({ where: { type: "MARKETPLACE_PROFIT" } })).toBe(0)
  })

  it("doesn't let a loss on one item cut the profit on another", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const buyer = await createUser()
    const profitable = await createProduct({ sellingPrice: 100, costPrice: 60 })
    const atLoss = await createProduct({ sellingPrice: 50, costPrice: 80 })
    await topUp(buyer, 150)
    const { body } = await checkout(buyer, {
      items: [{ productId: profitable.id, quantity: 1 }, { productId: atLoss.id, quantity: 1 }],
    })

    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
      await setOrderStatus(admin, body.data, status)
    }

    // 40 from the profitable item; the loss-making one counts as 0, not -30
    const fund = await prisma.rescueFund.findUnique({ where: { id: PAWAID_FUND_ID } })
    expect(fund.totalAvailable).toBe(40)
    await expectLedgerConsistent()
  })
})
