import React from "react";
import Header from "../partials/Header";
import Footer from "../partials/Footer";

type Props = {
  children: React.ReactNode;
};
const MainLayout: React.FC<Props> = ({ children }) => {
  return (
    <div>
      <Header />
      {children}
      <Footer />
    </div>
  );
};

export default MainLayout;
