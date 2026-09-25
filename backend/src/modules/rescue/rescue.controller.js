import { prisma } from "../../db"


export async function addArea(req, res){
    try {
        const {area} = req.body

    const areaCreated = await prisma.rescueArea.create({
        name: area
    })

    return res.json({
        message: "Area created",
        data: areaCreated
    })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to Create area" });
    }
}

export async function listAreas(req, res){
    try {
        const areas = await prisma.rescueArea.findMany()

        return res.json({
            message: "All Areas Listed",
            data: areas
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch area" });
    }
}
