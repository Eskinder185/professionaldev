import { Variants } from "framer-motion";
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: .4, ease: "easeOut" } }
};
export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: .06 } }
};

