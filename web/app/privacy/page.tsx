export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
                {/* Header Section */}
                <div className="text-center mb-12 sm:mb-16">
                    {/* Privacy Policy Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full border border-gray-200 mb-6">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-medium text-gray-700">PRIVACY POLICY</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
                        Privacy Policy
                    </h1>
                </div>

                {/* Content Sections */}
                <div className="space-y-10 sm:space-y-12">
                    {/* Introduction */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Introduction</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        This Privacy Policy describes how PAGZ and its affiliates (collectively "PAGZ, we, our, us") collect, use, share, protect or otherwise process your information/ personal data through our website (hereinafter referred to as Platform). Please note that you may be able to browse certain sections of the Platform without registering with us.
                                    </p>
                                    <p>
                                        We do not offer any product/service under this Platform outside India and your personal data will primarily be stored and processed in India. By visiting this Platform, providing your information or availing any product/service offered on the Platform, you expressly agree to be bound by the terms and conditions of this Privacy Policy, the Terms of Use and the applicable service/product terms and conditions, and agree to be governed by the laws of India including but not limited to the laws applicable to data protection and privacy. If you do not agree please do not use or access our Platform.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Collection */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Collection</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        We collect your personal data when you use our Platform, services or otherwise interact with us during the course of our relationship and related information provided from time to time. Some of the information that we may collect includes but is not limited to personal data / information provided to us during sign-up/registering or using our Platform such as name, date of birth, address, telephone/mobile number, email ID and/or any such information shared as proof of identity or address.
                                    </p>
                                    <p>
                                        Some of the sensitive personal data may be collected with your consent, such as your bank account or credit or debit card or other payment instrument information or biometric information such as your facial features or physiological information (in order to enable use of certain features when opted for, available on the Platform) etc all of the above being in accordance with applicable law(s). You always have the option to not provide information, by choosing not to use a particular service or feature on the Platform. We may track your behaviour, preferences, and other information that you choose to provide on our Platform.
                                    </p>
                                    <p>
                                        This information is compiled and analysed on an aggregated basis. We will also collect your information related to your transactions on Platform and such third-party business partner platforms. When such a third-party business partner collects your personal data directly from you, you will be governed by their privacy policies. We shall not be responsible for the third-party business partner's privacy practices or the content of their privacy policies, and we request you to read their privacy policies prior to disclosing any information.
                                    </p>
                                    <p>
                                        If you receive an email, a call from a person/association claiming to be PAGZ seeking any personal data like debit/credit card PIN, net-banking or mobile banking password, we request you to never provide such information. If you have already revealed such information, report it immediately to an appropriate law enforcement agency.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Usage */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Usage</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        We use personal data to provide the services you request. To the extent we use your personal data to market to you, we will provide you the ability to opt-out of such uses. We use your personal data to assist sellers and business partners in handling and fulfilling orders; enhancing customer experience; to resolve disputes; troubleshoot problems; inform you about online and offline offers, products, services, and updates; customise your experience; detect and protect us against error, fraud and other criminal activity; enforce our terms and conditions; conduct marketing research, analysis and surveys; and as otherwise described to you at the time of collection of information.
                                    </p>
                                    <p>
                                        You understand that your access to these products/services may be affected in the event permission is not provided to us.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Sharing */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Sharing</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        We may share your personal data internally within our group entities, our other corporate entities, and affiliates to provide you access to the services and products offered by them. These entities and affiliates may market to you as a result of such sharing unless you explicitly opt-out.
                                    </p>
                                    <p>
                                        We may disclose personal data to third parties such as sellers, business partners, third party service providers including logistics partners, prepaid payment instrument issuers, third-party reward programs and other payment opted by you. These disclosure may be required for us to provide you access to our services and products offered to you, to comply with our legal obligations, to enforce our user agreement, to facilitate our marketing and advertising activities, to prevent, detect, mitigate, and investigate fraudulent or illegal activities related to our services.
                                    </p>
                                    <p>
                                        We may disclose personal and sensitive personal data to government agencies or other authorised law enforcement agencies if required to do so by law or in the good faith belief that such disclosure is reasonably necessary to respond to subpoenas, court orders, or other legal process. We may disclose personal data to law enforcement offices, third party rights owners, or others in the good faith belief that such disclosure is reasonably necessary to: enforce our Terms of Use or Privacy Policy; respond to claims that an advertisement, posting or other content violates the rights of a third party; or protect the rights, property or personal safety of our users or the general public.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Security Precautions */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Security Precautions</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        To protect your personal data from unauthorised access or disclosure, loss or misuse we adopt reasonable security practices and procedures. Once your information is in our possession or whenever you access your account information, we adhere to our security guidelines to protect it against unauthorised access and offer the use of a secure server.
                                    </p>
                                    <p>
                                        However, the transmission of information is not completely secure for reasons beyond our control. By using the Platform, the users accept the security implications of data transmission over the internet and the World Wide Web which cannot always be guaranteed as completely secure, and therefore, there would always remain certain inherent risks regarding use of the Platform. Users are responsible for ensuring the protection of login and password records for their account.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Data Deletion and Retention */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Data Deletion and Retention</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        You have an option to delete your account by visiting your profile and settings on our Platform, this action would result in you losing all information related to your account. You may also write to us at the contact information provided below to assist you with these requests. We may in event of any pending grievance, claims, pending shipments or any other services we may refuse or delay deletion of the account. Once the account is deleted, you will lose access to the account.
                                    </p>
                                    <p>
                                        We retain your personal data information for a period no longer than is required for the purpose for which it was collected or as required under any applicable law. However, we may retain data related to you if we believe it may be necessary to prevent fraud or future abuse or for other legitimate purposes. We may continue to retain your data in anonymised form for analytical and research purposes.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Your Rights */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Your Rights</h2>
                                <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                                    You may access, rectify, and update your personal data directly through the functionalities provided on the Platform.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Consent */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Consent</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        By visiting our Platform or by providing your information, you consent to the collection, use, storage, disclosure and otherwise processing of your information on the Platform in accordance with this Privacy Policy. If you disclose to us any personal data relating to other people, you represent that you have the authority to do so and permit us to use the information in accordance with this Privacy Policy.
                                    </p>
                                    <p>
                                        You, while providing your personal data over the Platform or any partner platforms or establishments, consent to us (including our other corporate entities, affiliates, lending partners, technology partners, marketing channels, business partners and other third parties) to contact you through SMS, instant messaging apps, call and/or e-mail for the purposes specified in this Privacy Policy.
                                    </p>
                                    <p>
                                        You have an option to withdraw your consent that you have already provided by writing to the Grievance Officer at the contact information provided below. Please mention "Withdrawal of consent for processing personal data" in your subject line of your communication. We may verify such requests before acting on our request. However, please note that your withdrawal of consent will not be retrospective and will be in accordance with the Terms of Use, this Privacy Policy, and applicable laws. In the event you withdraw consent given to us under this Privacy Policy, we reserve the right to restrict or deny the provision of our services for which we consider such information to be necessary.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Changes to this Privacy Policy */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Changes to this Privacy Policy</h2>
                                <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                                    Please check our Privacy Policy periodically for changes. We may update this Privacy Policy to reflect changes to our information practices. We may alert / notify you about the significant changes to the Privacy Policy, in the manner as may be required under applicable laws.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Grievance Officer */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Grievance Officer</h2>
                                <div className="space-y-3 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p><strong className="text-gray-900">Name:</strong> [Insert Name of the Officer]</p>
                                    <p><strong className="text-gray-900">Designation:</strong> [Insert Designation]</p>
                                    <p><strong className="text-gray-900">Company:</strong> [Insert Name and Address of the Company]</p>
                                    <p><strong className="text-gray-900">Contact us:</strong></p>
                                    <p><strong className="text-gray-900">Phone:</strong> [Insert Phone Number]</p>
                                    <p><strong className="text-gray-900">Time:</strong> Monday – Friday (9:00 – 18:00)</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

