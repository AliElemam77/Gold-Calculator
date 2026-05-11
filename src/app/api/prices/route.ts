import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const dataFilePath = path.join(process.cwd(), "src", "lib", "prices.json");

export async function GET() {
  try {
    const fileContents = await fs.readFile(dataFilePath, "utf8");
    return NextResponse.json(JSON.parse(fileContents));
  } catch (error) {
    console.error("Error reading prices data:", error);
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2), "utf8");
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error writing prices data:", error);
    return NextResponse.json(
      { error: "Failed to write data" },
      { status: 500 },
    );
  }
}
