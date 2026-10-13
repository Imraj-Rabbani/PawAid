import { z } from "zod";
import { prisma } from "../../db.js";

// Public storefront (PRD §14). Only active products are listed, and the cost
// price never leaves the server: shoppers see the profit each sale sends to
// the rescue fund instead (PRD §16).

const productSelect = {
    id: true,
    name: true,
    description: true,
    imageUrl: true,
    costPrice: true,
    sellingPrice: true,
    stockQty: true,
    createdAt: true,
    category: { select: { id: true, name: true } },
}

const SORTS = {
    newest: [{ createdAt: "desc" }, { id: "desc" }],
    price_asc: [{ sellingPrice: "asc" }, { id: "asc" }],
    price_desc: [{ sellingPrice: "desc" }, { id: "desc" }],
    name: [{ name: "asc" }, { id: "asc" }],
}

function toPublicProduct({ costPrice, ...product }) {
    return { ...product, rescueContribution: Math.max(product.sellingPrice - costPrice, 0) }
}

function pageParams(query) {
    const page = Math.max(parseInt(query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(query.limit) || 12, 1), 48)
    return { page, limit, skip: (page - 1) * limit }
}

export async function listProducts(req, res) {
    try {
        const paging = pageParams(req.query)
        const search = typeof req.query.search === "string" ? req.query.search.trim() : ""
        const categoryId = z.uuid().safeParse(req.query.categoryId)

        const where = {
            active: true,
            ...(categoryId.success && { categoryId: categoryId.data }),
            ...(req.query.inStock === "true" && { stockQty: { gt: 0 } }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ],
            }),
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                select: productSelect,
                orderBy: SORTS[req.query.sort] ?? SORTS.newest,
                skip: paging.skip,
                take: paging.limit,
            }),
            prisma.product.count({ where }),
        ])

        return res.json({
            message: "Products listed",
            data: products.map(toPublicProduct),
            pagination: {
                page: paging.page,
                limit: paging.limit,
                total,
                totalPages: Math.max(Math.ceil(total / paging.limit), 1),
            },
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch products" });
    }
}

export async function getProduct(req, res) {
    try {
        const productId = z.uuid().safeParse(req.params.productId)
        if (!productId.success) return res.status(404).json({ message: "Product not found" })

        const product = await prisma.product.findFirst({
            where: { id: productId.data, active: true },
            select: productSelect,
        })
        if (!product) return res.status(404).json({ message: "Product not found" })

        // in-stock items first, so "you may also like" is mostly buyable
        const related = await prisma.product.findMany({
            where: { active: true, categoryId: product.category.id, id: { not: product.id } },
            select: productSelect,
            orderBy: [{ stockQty: "desc" }, { createdAt: "desc" }],
            take: 4,
        })

        return res.json({
            message: "Product fetched",
            data: { ...toPublicProduct(product), related: related.map(toPublicProduct) },
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch product" });
    }
}

// categories with at least one active product, so the storefront never shows an empty filter
export async function listMarketplaceCategories(req, res) {
    try {
        const categories = await prisma.productCategory.findMany({
            where: { products: { some: { active: true } } },
            select: {
                id: true,
                name: true,
                _count: { select: { products: { where: { active: true } } } },
            },
            orderBy: { name: "asc" },
        })

        return res.json({
            message: "Categories listed",
            data: categories.map(({ _count, ...category }) => ({ ...category, productCount: _count.products })),
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch categories" });
    }
}
