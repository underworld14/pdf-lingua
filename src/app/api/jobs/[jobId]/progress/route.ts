import { NextRequest, NextResponse } from "next/server";
import { JobService } from "@/lib/services/jobService";

export async function GET(request: NextRequest, props: { params: Promise<{ jobId: string }> }) {
  const params = await props.params;
  // Ensure params are properly awaited in Next.js App Router
  const { jobId } = params;

  // Initialize job service
  const jobService = new JobService();

  // Check if job exists
  const job = await jobService.getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  // Set up SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = async (jobId: string) => {
        // Get the latest job data from the database
        const currentJob = await jobService.getJob(jobId);
        if (!currentJob) {
          return null; // Job no longer exists
        }
        
        // Format the job data for client response
        const formattedJob = jobService.formatJobResponse(currentJob);
        
        // Send the formatted job data
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(formattedJob)}\n\n`)
        );
        
        return formattedJob;
      };
      
      // Send initial state
      sendEvent(jobId);
      
      // Set up interval to check for updates
      const intervalId = setInterval(async () => {
        const formattedJob = await sendEvent(jobId);
        
        // If job is no longer in the database or is completed/failed, end the stream
        if (!formattedJob || formattedJob.status === "COMPLETED" || formattedJob.status === "FAILED") {
          clearInterval(intervalId);
          controller.close();
        }
      }, 1000); // Check every second
      
      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        controller.close();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
