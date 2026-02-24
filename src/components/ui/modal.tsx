"use client";

import { PropsWithChildren } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

type ModalProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
}>;

export function Modal({ open, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={cn("w-full max-w-lg rounded-md border border-[#2a2a2a] bg-[#141414] p-6 shadow-2xl")}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between border-b border-[#2a2a2a] pb-4">
              <h2 className="text-lg font-medium text-[#ffffff]">{title}</h2>
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-xs text-[#9a9a9a] transition-colors hover:bg-[#1a1a1a] hover:text-[#ffffff]"
                onClick={onClose}
              >
                닫기
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
