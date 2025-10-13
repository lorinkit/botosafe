"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/partials/Header";
import {
  FaUser,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaUniversity,
  FaTransgender,
  FaListAlt,
  FaIdCard,
  FaCalendarAlt,
} from "react-icons/fa";

type FormData = {
  fullname: string;
  age: string;
  gender: string;
  course: string;
  year_level: string;
  school_id: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const SignupPage: React.FC = () => {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    fullname: "",
    age: "",
    gender: "",
    course: "",
    year_level: "",
    school_id: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [statusMessage, setStatusMessage] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Validation patterns
  const schoolIdPattern = /^(ESU-[A-Z]+-\d{4}-\d{5}|\d{4}-\d{5})$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const fullnamePattern = /^[A-Za-z\s.]+$/;
  const agePattern = /^[1-9][0-9]?$/; // 1–99

  const [touched, setTouched] = useState<Record<string, boolean>>({
    fullname: false,
    age: false,
    school_id: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleBlur = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const isFullnameValid =
    formData.fullname.trim() !== "" && fullnamePattern.test(formData.fullname);
  const isAgeValid =
    formData.age.trim() !== "" && agePattern.test(formData.age);
  const isEmailValid =
    formData.email.trim() !== "" && emailPattern.test(formData.email);
  const isSchoolIdValid =
    formData.school_id.trim() !== "" &&
    schoolIdPattern.test(formData.school_id);

  const password = formData.password;
  const passwordRules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    specialChar: /[\W_]/.test(password),
  };
  const allPasswordRulesMet = Object.values(passwordRules).every(Boolean);
  const passwordsMatch =
    formData.confirmPassword.trim() !== "" &&
    formData.password === formData.confirmPassword;

  const allFieldsFilled = Object.values(formData).every((v) => v.trim() !== "");
  const allFormatsValid =
    isFullnameValid && isAgeValid && isEmailValid && isSchoolIdValid;

  const isFormValid =
    allFieldsFilled &&
    allFormatsValid &&
    allPasswordRulesMet &&
    passwordsMatch &&
    agreePrivacy;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setStatusMessage("");
    setTouched({
      fullname: true,
      age: true,
      school_id: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (!isFormValid) {
      setStatusMessage("Please fix highlighted fields before submitting.");
      setIsSuccessful(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          age: parseInt(formData.age, 10),
          role: "voter",
        }),
      });

      const data: { message?: string } = await res.json();
      if (!res.ok) {
        setStatusMessage(data.message || "Something went wrong.");
        setIsSuccessful(false);
      } else {
        setStatusMessage("Account created successfully!");
        setIsSuccessful(true);
        router.push("/signin/login");
      }
    } catch {
      setStatusMessage("An error occurred. Please try again.");
      setIsSuccessful(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const iconMap: Record<string, React.ReactNode> = {
    fullname: <FaUser />,
    age: <FaCalendarAlt />,
    school_id: <FaIdCard />,
    email: <FaEnvelope />,
  };

  return (
    <>
      <Header />
      <main
        className="min-h-screen flex items-center justify-center
        bg-gradient-to-br from-white via-purple-100 to-red-100
        dark:from-pink-50 dark:via-purple-100 dark:to-blue-50
        px-4 py-20 transition-colors duration-300"
      >
        <div className="w-full max-w-lg bg-white/90 dark:bg-white/20 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-red-200 dark:border-pink-200">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#791010] dark:text-pink-500 text-center mb-6">
            Create Your BotoSafe Account
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input fields */}
            {(["fullname", "age", "school_id", "email"] as const).map(
              (field) => {
                const value = formData[field];
                const showError =
                  touched[field] &&
                  ((field === "fullname" && !isFullnameValid && value !== "") ||
                    (field === "age" && !isAgeValid && value !== "") ||
                    (field === "email" && !isEmailValid && value !== "") ||
                    (field === "school_id" &&
                      !isSchoolIdValid &&
                      value !== ""));

                const placeholder =
                  field === "school_id"
                    ? "Enter School ID (ESU-PAGA-2022-03849 or 2022-03849)"
                    : field
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase());

                return (
                  <div className="relative" key={field}>
                    {/* Centered icon */}
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-gray-500 dark:text-gray-700 pointer-events-none h-0">
                      {iconMap[field]}
                    </span>

                    <input
                      name={field}
                      type={
                        field === "age"
                          ? "number"
                          : field === "email"
                          ? "email"
                          : "text"
                      }
                      value={value}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder={placeholder}
                      required
                      className={`w-full h-11 pl-10 pr-4 rounded-md border transition focus:outline-none
                      ${
                        showError
                          ? "border-red-400 ring-0"
                          : "border-gray-300 dark:border-gray-400"
                      }
                      bg-white dark:bg-white/10 text-black dark:text-gray-900 text-sm
                      focus:ring-4 focus:ring-purple-200`}
                    />
                    {field === "school_id" && (
                      <p className="text-xs text-gray-500 mt-1 pl-1">
                        Format example:{" "}
                        <span className="font-medium text-gray-700">
                          ESU-PAGA-2022-03849
                        </span>{" "}
                        or{" "}
                        <span className="font-medium text-gray-700">
                          2022-03849
                        </span>
                      </p>
                    )}
                    {showError && (
                      <p className="text-sm text-red-500 font-medium mt-1 pl-1">
                        {field === "fullname" &&
                          "Full name may only contain letters, spaces, and periods."}
                        {field === "age" && "Enter a valid age (1–99)."}
                        {field === "email" && "Enter a valid email address."}
                        {field === "school_id" &&
                          "Invalid school ID. Use ESU-AREA-YYYY-XXXXX or YYYY-XXXXX."}
                      </p>
                    )}
                  </div>
                );
              }
            )}

            {/* Course */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-gray-500 dark:text-gray-700 pointer-events-none h-0">
                <FaListAlt />
              </span>
              <select
                name="course"
                value={formData.course}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                className="w-full h-11 pl-10 pr-4 rounded-md border border-gray-300 dark:border-gray-400 bg-white dark:bg-white/10 text-black dark:text-gray-900 text-sm focus:outline-none focus:ring-4 focus:ring-purple-200"
              >
                <option value="">Select Course</option>
                <option value="BSCS">BSCS</option>
                <option value="ACT">ACT</option>
                <option value="BSED English">BSED English</option>
                <option value="BSED Science">BSED Science</option>
                <option value="BEED">BEED</option>
                <option value="BSCrim">BSCrim</option>
                <option value="BSSW">BSSW</option>
              </select>
            </div>

            {/* Year Level */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-gray-500 dark:text-gray-700 pointer-events-none h-0">
                <FaUniversity />
              </span>
              <select
                name="year_level"
                value={formData.year_level}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                className="w-full h-11 pl-10 pr-4 rounded-md border border-gray-300 dark:border-gray-400 bg-white dark:bg-white/10 text-black dark:text-gray-900 text-sm focus:outline-none focus:ring-4 focus:ring-purple-200"
              >
                <option value="">Select Year Level</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            {/* Gender */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-gray-500 dark:text-gray-700 pointer-events-none h-0">
                <FaTransgender />
              </span>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                className="w-full h-11 pl-10 pr-4 rounded-md border border-gray-300 dark:border-gray-400 bg-white dark:bg-white/10 text-black dark:text-gray-900 text-sm focus:outline-none focus:ring-4 focus:ring-purple-200"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="lesbian">Lesbian</option>
                <option value="gay">Gay</option>
                <option value="bisexual">Bisexual</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            {/* Passwords */}
            {(["password", "confirmPassword"] as const).map((name) => {
              const isPwd = name === "password";
              const showError =
                touched[name] &&
                ((isPwd && !allPasswordRulesMet && formData.password !== "") ||
                  (!isPwd &&
                    formData.confirmPassword !== "" &&
                    !passwordsMatch));

              return (
                <div className="relative" key={name}>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-gray-500 dark:text-gray-700 pointer-events-none h-0">
                    <FaLock />
                  </span>

                  <input
                    type={
                      (isPwd && showPassword) || (!isPwd && showConfirmPassword)
                        ? "text"
                        : "password"
                    }
                    name={name}
                    placeholder={isPwd ? "Password" : "Confirm Password"}
                    value={formData[name]}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    className={`w-full h-11 pl-10 pr-10 rounded-md border ${
                      showError
                        ? "border-red-400"
                        : "border-gray-300 dark:border-gray-400"
                    } bg-white dark:bg-white/10 text-black dark:text-gray-900 text-sm focus:outline-none focus:ring-4 focus:ring-purple-200`}
                  />

                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-gray-500 dark:text-gray-700 cursor-pointer"
                    onClick={() =>
                      isPwd
                        ? setShowPassword(!showPassword)
                        : setShowConfirmPassword(!showConfirmPassword)
                    }
                    role="button"
                    tabIndex={0}
                  >
                    {(isPwd && showPassword) ||
                    (!isPwd && showConfirmPassword) ? (
                      <FaEyeSlash />
                    ) : (
                      <FaEye />
                    )}
                  </span>

                  {showError && (
                    <p className="text-sm text-red-500 font-medium mt-1 pl-1">
                      {isPwd &&
                        !allPasswordRulesMet &&
                        "Password must meet all requirements below."}
                      {!isPwd &&
                        formData.confirmPassword !== "" &&
                        !passwordsMatch &&
                        "Passwords do not match."}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Password rules */}
            <div className="text-sm mt-2">
              <p className="font-semibold text-gray-700 dark:text-gray-900 mb-1">
                Password must include:
              </p>
              <ul className="space-y-1">
                {Object.entries(passwordRules).map(([key, valid]) => (
                  <li
                    key={key}
                    className={valid ? "text-green-600" : "text-red-500"}
                  >
                    {valid ? "✔" : "✖"}{" "}
                    {key === "length"
                      ? "At least 8 characters"
                      : key === "uppercase"
                      ? "One uppercase letter"
                      : key === "lowercase"
                      ? "One lowercase letter"
                      : key === "number"
                      ? "One number"
                      : "One special character"}
                  </li>
                ))}
              </ul>
            </div>

            {/* Privacy checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="privacy"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="w-4 h-4 accent-[#791010]"
              />
              <label
                htmlFor="privacy"
                className="text-sm text-gray-700 dark:text-gray-900"
              >
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="text-[#791010] dark:text-pink-500 hover:underline"
                >
                  Privacy Policy
                </button>
              </label>
            </div>

            {statusMessage && (
              <p
                className={`text-sm ${
                  isSuccessful ? "text-green-500" : "text-red-500"
                }`}
              >
                {statusMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`w-full font-semibold py-2 rounded-lg transition-all ${
                isFormValid
                  ? "bg-[#791010] hover:bg-red-800 text-white"
                  : "bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? "Signing Up..." : "Sign Up"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
};

export default SignupPage;
