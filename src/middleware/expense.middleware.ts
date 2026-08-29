import { db } from '../config/database';

export async function syncFixedExpenses(userId: string) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1 ~ 12

   
    const fixedList = await db.collection('regular').find({ userId }).toArray();

    for (const fixed of fixedList) {
      // original 정보로 원본 거래내역 가져오기
      const originalExpense = fixed.expenseInfo;
      if (!originalExpense?.date) continue;

      const [, , originalDayString] = originalExpense.date.split('-');
      const originalDay = Number(originalDayString);

      if (!Number.isInteger(originalDay) || originalDay < 1 || originalDay > 31) {
        continue;
      }

      // lastUpdate 파싱 (예: "2026-05" -> year: 2026, month: 5)
      const [lastYearStr, lastMonthStr] = fixed.lastUpdate.split('-');
      let targetYear = Number(lastYearStr);
      let targetMonth = Number(lastMonthStr);

      if (
        !Number.isInteger(targetYear) ||
        !Number.isInteger(targetMonth) ||
        targetMonth < 1 ||
        targetMonth > 12
      ) {
        continue;
      }

      // targetMonth를 1달씩 증가시키며 현재 연/월까지 채워 넣기
      while (true) {
        // 다음 달 계산
        targetMonth++;
        if (targetMonth > 12) {
          targetMonth = 1;
          targetYear++;
        }

        // target(생성 대상)이 현재 연/월보다 뒤에 있으면 중단
        if (targetYear > currentYear || (targetYear === currentYear && targetMonth > currentMonth)) {
          break;
        }

        // 2. 해당 연/월에 추가할 날짜 결정 
        // (원본 날짜의 '일(day)'을 사용하되, 해당 달의 마지막 날을 넘지 않도록 안전 처리)
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const targetDay = Math.min(originalDay, daysInMonth);
        const targetDate = [
          targetYear,
          String(targetMonth).padStart(2, '0'),
          String(targetDay).padStart(2, '0')
        ].join('-');

        // 3. 새로운 transection 내역 생성
        const newExpense = {
          event: originalExpense.event,
          category: originalExpense.category,
          price: originalExpense.price,
          explanation: `[고정비] ${originalExpense.explanation || ''}`.trim(),
          isFixed: true,
          moneyType: 'expense',
          date: targetDate,
          userId: originalExpense.userId,
          name: originalExpense.name,
          createdAt: new Date()
        };

        // DB에 새 지출 내역 삽입
        await db.collection('transection').insertOne(newExpense);

        // 4. fixed_expenses의 lastUpdate를 방금 생성한 연/월로 업데이트
        const updatedLastUpdate = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
        
        await db.collection('regular').updateOne(
          { _id: fixed._id },
          { $set: { lastUpdate: updatedLastUpdate } }
        );
      }
    }
  } catch (error) {
    console.error('고정비 동기화 중 에러 발생:', error);
  }
}