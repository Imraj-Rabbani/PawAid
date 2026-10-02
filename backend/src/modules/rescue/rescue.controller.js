import { prisma } from "../../db"


export async function addArea(req, res){
    try {
        const name = typeof req.body?.area === "string" ? req.body.area.trim() : ""

        if (!name) {
            return res.status(400).json({ error: "Area name is required" })
        }

        const areaCreated = await prisma.rescueArea.create({
            data: { name }
        })

        return res.status(201).json({
            message: "Area created",
            data: areaCreated
        })
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({ error: "Area already exists" })
        }
        console.error(error);
        res.status(500).json({ error: "Failed to Create area" });
    }
}

export async function listAreas(req, res){
    try {
        const areas = await prisma.rescueArea.findMany({ orderBy: { name: "asc" } })

        return res.json({
            message: "All Areas Listed",
            data: areas
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch area" });
    }
}
