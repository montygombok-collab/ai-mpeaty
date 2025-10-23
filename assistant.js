/**
 * Assistant Class (فئة المساعد)
 *
 * هذه الفئة توفر مجموعة من الوظائف المساعدة العامة (Utility Functions)
 * مثل العمليات الحسابية البسيطة والتعامل مع النصوص.
 */
class Assistant {

    // البناء (Constructor)
    constructor(name = "المساعد الرقمي") {
        // تهيئة الاسم الافتراضي للمساعد
        this.name = name;
        console.log(`[Assistant] تم تهيئة ${this.name} بنجاح.`);
    }

    /**
     * حساب المجموع (Calculate Sum)
     *
     * وظيفة لحساب مجموع رقمين وإرجاع النتيجة.
     * @param {number} a - الرقم الأول.
     * @param {number} b - الرقم الثاني.
     * @returns {number} - مجموع الرقمين.
     */
    calculateSum(a, b) {
        // التحقق من أن المدخلات أرقام
        if (typeof a !== 'number' || typeof b !== 'number') {
            console.error("[Assistant Error] يجب أن تكون المدخلات أرقاماً.");
            return NaN;
        }
        return a + b;
    }

    /**
     * رسالة ترحيب (Generate Greeting)
     *
     * وظيفة لإنشاء رسالة ترحيب مخصصة.
     * @param {string} userName - اسم المستخدم المُراد تحيته.
     * @returns {string} - رسالة الترحيب.
     */
    generateGreeting(userName) {
        if (!userName || typeof userName !== 'string') {
            userName = "صديقنا العزيز";
        }
        return `أهلاً بك يا ${userName}! ${this.name} في خدمتك.`;
    }

    /**
     * تنسيق التاريخ (Format Date)
     *
     * وظيفة بسيطة لتنسيق التاريخ الحالي إلى سلسلة نصية.
     * @returns {string} - التاريخ المنسق.
     */
    formatCurrentDate() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        // استخدام اللغة العربية في التنسيق
        return now.toLocaleDateString('ar-EG', options);
    }
}

// -------------------------------------------------------------------
// مثال على الاستخدام (Example Usage)
// -------------------------------------------------------------------

// إنشاء مثيل جديد من المساعد
const myAssistant = new Assistant("المساعد الشخصي");

// 1. استخدام وظيفة الترحيب
const greetingMessage = myAssistant.generateGreeting("علي");
console.log(greetingMessage);

// 2. استخدام وظيفة حساب المجموع
const num1 = 15;
const num2 = 27;
const sumResult = myAssistant.calculateSum(num1, num2);
console.log(`[العمليات الحسابية] مجموع ${num1} و ${num2} هو: ${sumResult}`);

// 3. استخدام وظيفة تنسيق التاريخ
const currentDate = myAssistant.formatCurrentDate();
console.log(`[التاريخ الحالي] اليوم هو: ${currentDate}`);

// مثال على خطأ (Error Example)
const errorResult = myAssistant.calculateSum(10, "خمسة");
console.log(`[مثال خطأ] نتيجة المحاولة غير الصالحة: ${errorResult}`);

// تصدير الفئة لإمكانية استخدامها في ملفات أخرى (إذا تم استخدام نظام الوحدات Modules)
// export default Assistant;
