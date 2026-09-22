import bcrypt from "bcryptjs";
import { prisma } from "../../db";


export async function createUser({name, email, password}){
    const existingUser = await prisma.user.findUnique({
       where: {email: email.toLowerCase()} 
    })
    

    if(existingUser){
        const error = new Error("User with this email already exists.");
        error.statusCode = 409;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
        data: {
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
        }
    })

    return user;
}