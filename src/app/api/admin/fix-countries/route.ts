import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { Person } from "@/models/Almanac";

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Fix "United States" → "USA"
    const result = await Person.updateMany(
      { countryBorn: { $in: ["United States", "United States of America", "U.S.A.", "U.S.", "US"] } },
      { $set: { countryBorn: "USA" } }
    );

    return NextResponse.json({
      success: true,
      message: `Fixed ${result.modifiedCount} entries from "United States" to "USA"`,
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

  } catch (error: any) {
    console.error("Fix countries error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await dbConnect();

    // Get country distribution
    const countries = await Person.aggregate([
      { $group: { _id: "$countryBorn", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return NextResponse.json({
      success: true,
      countries
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
