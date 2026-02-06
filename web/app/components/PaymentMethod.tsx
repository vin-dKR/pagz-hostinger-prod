"use client";

import { useState } from "react";

export default function PaymentMethod() {
    const [paymentMethod, setPaymentMethod] = useState<"paypal" | "creditcard">("creditcard");
    const [cardData, setCardData] = useState({
        cardNumber: "",
        expirationDate: "",
        cvv: "",
    });

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
            <h2 className="text-xl font-hkgb font-bold text-gray-900 mb-6">Payment Method</h2>

            <div className="space-y-4">
                {/* PayPal Option */}
                <label
                    className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${paymentMethod === "paypal"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                >
                    <input
                        type="radio"
                        name="payment"
                        value="paypal"
                        checked={paymentMethod === "paypal"}
                        onChange={() => setPaymentMethod("paypal")}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 flex items-center justify-between">
                        <div>
                            <p className="font-bold text-gray-900">PayPal</p>
                            <p className="text-sm text-gray-600">
                                You will be redirected to the PayPal website after submitting your order
                            </p>
                        </div>
                        <div className="ml-4">
                            <div className="w-16 h-10 bg-[#008ECC] rounded flex items-center justify-center text-white font-bold text-xs">
                                PayPal
                            </div>
                        </div>
                    </div>
                </label>

                {/* Credit Card Option */}
                <label
                    className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${paymentMethod === "creditcard"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                >
                    <input
                        type="radio"
                        name="payment"
                        value="creditcard"
                        checked={paymentMethod === "creditcard"}
                        onChange={() => setPaymentMethod("creditcard")}
                        className="w-5 h-5 mt-1 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="relative flex-1">
                        <div className=" flex items-center justify-between mb-4">
                            <p className="font-bold text-gray-900">Pay with Credit Card</p>
                            <div className="flex items-center gap-2">
                                <div className="">
                                    <svg width="40" height="28" viewBox="0 0 79 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.922145" y="0.924098" width="76.538" height="53.4844" rx="6.45501" fill="white" stroke="#B2BCCA" strokeWidth="1.84429" />
                                        <path fillRule="evenodd" clipRule="evenodd" d="M24.7839 36.5617H20.0354L16.4747 22.5776C16.3057 21.9344 15.9468 21.3657 15.419 21.0976C14.1016 20.4241 12.65 19.888 11.0664 19.6177V19.0793H18.7158C19.7715 19.0793 20.5633 19.888 20.6953 20.8273L22.5428 30.9144L27.2889 19.0793H31.9054L24.7839 36.5617ZM34.5441 36.5617H30.0596L33.7523 19.0793H38.2368L34.5441 36.5617ZM44.0398 23.9211C44.1718 22.9796 44.9636 22.4412 45.8873 22.4412C47.3389 22.306 48.9202 22.5764 50.2399 23.2476L51.0317 19.4835C49.712 18.9452 48.2604 18.6748 46.9431 18.6748C42.5905 18.6748 39.4233 21.0964 39.4233 24.4572C39.4233 27.014 41.6667 28.3564 43.2503 29.1652C44.9636 29.9716 45.6234 30.51 45.4914 31.3164C45.4914 32.526 44.1718 33.0644 42.8544 33.0644C41.2708 33.0644 39.6873 32.6612 38.2379 31.9876L37.4462 35.754C39.0297 36.4252 40.743 36.6956 42.3266 36.6956C47.207 36.8284 50.2399 34.4092 50.2399 30.778C50.2399 26.2052 44.0398 25.9372 44.0398 23.9211ZM65.933 36.5617L62.3722 19.0793H58.5475C57.7557 19.0793 56.9639 19.6177 56.7 20.4241L50.1063 36.5617H54.7228L55.6443 34.0072H61.3165L61.8444 36.5617H65.933ZM59.2076 23.7867L60.525 30.3755H56.8323L59.2076 23.7867Z" fill="#28356A" />
                                    </svg>

                                </div>

                                <div>
                                    <svg width="40" height="28" viewBox="0 0 79 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.922145" y="0.924098" width="76.538" height="53.4844" rx="6.45501" fill="white" stroke="#B2BCCA" strokeWidth="1.84429" />
                                        <path d="M42.418 53.4855L77.4595 42.8809V47.9527C77.4595 51.0084 74.9823 53.4855 71.9266 53.4855H42.418Z" fill="#FD6020" />
                                        <path d="M51.6182 28.4385L54.5098 21.0068H56.6787L52.2207 32.2783H51.1357L46.6777 21.0068H48.8467L51.6182 28.4385ZM32.6992 21.0059C33.5426 21.0059 34.5066 21.1297 35.2295 21.625V24.1025C34.627 23.3594 33.6631 22.8633 32.6992 22.8633C30.7716 22.9872 29.2058 24.7215 29.3262 26.7031V26.9512C29.3262 28.9329 30.8925 30.4189 32.8203 30.4189C33.784 30.4188 34.6271 29.9237 35.2295 29.1807V31.6582C34.3862 32.0297 33.5428 32.2773 32.5791 32.2773C29.5669 32.2773 27.1572 29.6756 27.1572 26.5791C27.1575 23.359 29.5667 20.7583 32.6992 21.0059ZM23.0605 20.7588C24.1449 20.7588 25.2298 21.2539 26.0732 21.9971L24.9883 23.4834C24.5064 22.988 23.9041 22.6163 23.3018 22.6162C22.5788 22.4924 21.976 23.1123 21.8555 23.8555C21.8557 24.4744 22.2173 24.7225 23.4219 25.2178C25.8315 26.2086 26.4341 26.9514 26.5547 28.4375V28.8096C26.4341 30.7911 24.8681 32.277 22.9404 32.1533C21.4946 32.1533 20.0481 31.4103 19.3252 30.0479L20.6504 28.6855C21.0118 29.5525 21.8555 30.1718 22.8193 30.1719H22.9404C23.6633 30.1717 24.3857 29.4284 24.3857 28.5615C24.3857 28.0662 24.1446 27.695 23.7832 27.4473C23.3014 27.1996 22.8197 26.952 22.3379 26.8281C20.4103 26.2089 19.8077 25.3415 19.8076 23.8555V23.7314C19.9281 21.9974 21.3737 20.6349 23.0605 20.7588ZM10.5322 21.0078C13.4236 21.1319 15.713 23.6088 15.5928 26.5811C15.5928 28.1911 14.8698 29.6783 13.665 30.793C12.5808 31.6599 11.2549 32.155 9.92969 32.0312H6.91797V21.0078H10.5322ZM67.7646 21.0078C70.1744 21.0078 71.5 22.1229 71.5 24.2285C71.6203 25.8385 70.5356 27.2005 69.0898 27.4482L72.3428 32.0312H69.8125L67.042 27.5723H66.8008V32.0312H64.752V21.0078H67.7646ZM18.4824 32.0303H16.4346V21.0068H18.4824V32.0303ZM63.4268 22.8643H59.6914V25.3418H63.3057V27.2002H59.6914V30.1729H63.4268V32.0303H57.6436V21.0068H63.4268V22.8643ZM12.3408 23.7324C11.618 23.1132 10.5331 22.7415 9.56934 22.8652H8.9668V30.1729H9.56934C10.5331 30.2966 11.618 29.9249 12.3408 29.3057C13.0635 28.5626 13.4248 27.5716 13.4248 26.457C13.4248 25.4664 13.0635 24.4755 12.3408 23.7324ZM66.8018 26.084H67.4043C68.7295 26.0839 69.332 25.4643 69.332 24.3496C69.332 23.3588 68.7295 22.7393 67.4043 22.7393H66.8018V26.084Z" fill="black" />
                                        <path fillRule="evenodd" clipRule="evenodd" d="M41.3745 20.748C38.3623 20.748 35.832 23.2252 35.832 26.4456C35.832 29.5421 38.2418 32.1432 41.3745 32.267C44.5072 32.3909 46.917 29.7898 47.0375 26.5695C46.917 23.3491 44.5072 20.748 41.3745 20.748V20.748Z" fill="#FD6020" />
                                    </svg>

                                </div>
                                <div>
                                    <svg width="40" height="28" viewBox="0 0 79 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.922145" y="0.924098" width="76.538" height="53.4844" rx="6.45501" fill="white" stroke="#B2BCCA" strokeWidth="1.84429" />
                                        <path d="M29.1104 11.5264C37.55 11.5265 44.3914 18.4478 44.3916 26.9854C44.3916 35.5231 37.5501 42.4452 29.1104 42.4453C20.6704 42.4453 13.8281 35.5232 13.8281 26.9854C13.8283 18.4477 20.6706 11.5264 29.1104 11.5264Z" fill="#ED0006" />
                                        <path d="M48.9385 11.5264C57.3781 11.5265 64.2195 18.4477 64.2197 26.9854C64.2197 35.5232 57.3783 42.4452 48.9385 42.4453C40.4986 42.4453 33.6562 35.5232 33.6562 26.9854C33.6565 18.4477 40.4987 11.5264 48.9385 11.5264Z" fill="#2F80ED" />
                                        <path d="M39.0244 15.2227C42.3092 18.0581 44.3925 22.2757 44.3926 26.9863C44.3926 31.6969 42.3091 35.9145 39.0244 38.75C35.7399 35.9145 33.6562 31.6968 33.6562 26.9863C33.6564 22.2759 35.7398 18.0581 39.0244 15.2227Z" fill="#6C6BBD" />
                                    </svg>

                                </div>
                                <div>
                                    <svg width="40" height="28" viewBox="0 0 79 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.922145" y="0.924098" width="76.538" height="53.4844" rx="6.45501" fill="white" stroke="#B2BCCA" strokeWidth="1.84429" />
                                        <path d="M49.748 11.5947C58.3812 11.5949 65.3799 18.5106 65.3799 27.041C65.3798 35.5714 58.3812 42.4872 49.748 42.4873C45.878 42.4873 42.3364 41.0968 39.6064 38.7949C36.8767 41.096 33.3371 42.4863 29.4678 42.4863C20.8346 42.4863 13.8361 35.5714 13.8359 27.041C13.8359 18.5105 20.8345 11.5947 29.4678 11.5947C33.3373 11.5947 36.8777 12.9849 39.6074 15.2861C42.3372 12.9847 45.8784 11.5947 49.748 11.5947Z" fill="#ED0006" />
                                        <path d="M49.748 11.5947C58.3812 11.5949 65.3799 18.5106 65.3799 27.041C65.3798 35.5714 58.3812 42.4872 49.748 42.4873C45.879 42.4873 42.339 41.0967 39.6094 38.7959C42.9702 35.9629 45.1015 31.7482 45.1016 27.041C45.1016 22.3336 42.9704 18.1182 39.6094 15.2852C42.339 12.9846 45.8792 11.5947 49.748 11.5947Z" fill="#F9A000" />
                                        <path d="M39.6045 15.2852C42.9652 18.1182 45.0967 22.3329 45.0967 27.04C45.0966 31.7472 42.9653 35.9619 39.6045 38.7949C36.244 35.9619 34.1133 31.747 34.1133 27.04C34.1133 22.3331 36.244 18.1182 39.6045 15.2852Z" fill="#FD6020" />
                                    </svg>

                                </div>
                            </div>
                        </div>

                        {paymentMethod === "creditcard" && (
                            <div className="space-y-4 mt-4">
                                {/* Card Number */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Card number
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={cardData.cardNumber}
                                            onChange={(e) =>
                                                setCardData({ ...cardData, cardNumber: e.target.value })
                                            }
                                            placeholder="1234 5678 9101 3456"
                                            maxLength={19}
                                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        {cardData.cardNumber && (
                                            <svg
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600"
                                            >
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                            </svg>
                                        )}
                                    </div>
                                </div>

                                {/* Expiration Date & CVV */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Expiration Date
                                        </label>
                                        <input
                                            type="text"
                                            value={cardData.expirationDate}
                                            onChange={(e) =>
                                                setCardData({ ...cardData, expirationDate: e.target.value })
                                            }
                                            placeholder="MM/YY"
                                            maxLength={5}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Card Security Code
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="password"
                                                value={cardData.cvv}
                                                onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                                                placeholder="***"
                                                maxLength={4}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                            <a
                                                href="#"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:underline"
                                            >
                                                What is this?
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </label>
            </div>

            {/* Security Message */}
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-600">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-600"
                >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>We protect your payment information using encryption to provide bank-level security.</span>
            </div>
        </div>
    );
}
