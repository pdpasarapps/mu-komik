"use client";

import { useEffect, useState } from "react";
import { getCurrentDevice, type CurrentDevice } from "@/lib/comic-target-device";

export function useCurrentDevice() {
  const [currentDevice, setCurrentDevice] = useState<CurrentDevice | null>(null);

  useEffect(() => {
    const updateDevice = () => setCurrentDevice(getCurrentDevice(window.innerWidth));
    updateDevice();
    window.addEventListener("resize", updateDevice);
    return () => window.removeEventListener("resize", updateDevice);
  }, []);

  return currentDevice;
}
