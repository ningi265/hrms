

class TravelExpenseService {
  static baseURL = process.env.REACT_APP_BACKEND_URL;

  static async getTravelExpenseAnalytics(params = {}) {
    const {
      period = 'monthly',
      startDate = '2024-01-01',
      endDate = '2024-12-31',
      departmentId = null,
      expenseType = null,
      travelType = null
    } = params;

    const queryParams = new URLSearchParams({
      period,
      start_date: startDate,
      end_date: endDate,
      ...(departmentId && { department_id: departmentId }),
      ...(expenseType && { expense_type: expenseType }),
      ...(travelType && { travel_type: travelType })
    });

    try {
      const response = await fetch(`${this.baseURL}/api/travel-requests/analytics?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching travel expense analytics:', error);
      throw error;
    }
  }

  static async getTravelExpenseBreakdown(params = {}) {
    const {
      startDate = '2024-01-01',
      endDate = '2024-12-31',
      groupBy = 'travel_type'
    } = params;

    const queryParams = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      group_by: groupBy
    });

    try {
      const response = await fetch(`${this.baseURL}/api/travel-requests/breakdown?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching travel expense breakdown:', error);
      throw error;
    }
  }

  static async exportTravelExpenseData(params = {}) {
    const {
      startDate = '2024-01-01',
      endDate = '2024-12-31',
      format = 'csv'
    } = params;

    const queryParams = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      format
    });

    try {
      const response = await fetch(`${this.baseURL}/api/travel-requests/export?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (format === 'csv') {
        const blob = await response.blob();
        return blob;
      } else {
        return await response.json();
      }
    } catch (error) {
      console.error('Error exporting travel expense data:', error);
      throw error;
    }
  }
}

export default TravelExpenseService;