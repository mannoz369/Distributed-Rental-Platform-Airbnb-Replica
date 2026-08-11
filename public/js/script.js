(() => {
    'use strict'
  
    // Fetch all the forms we want to apply custom Bootstrap validation styles to
    const forms = document.querySelectorAll('.needs-validation')
  
    // Loop over them and prevent submission
    Array.from(forms).forEach(form => {
      form.addEventListener('submit', event => {
        if (!form.checkValidity()) {
          event.preventDefault()
          event.stopPropagation()
        }
  
        form.classList.add('was-validated')
      }, false)
    })
  })();

(() => {
  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);

  const getDatesBetween = (start, end, includeEndDate = true) => {
    const dates = [];
    const cursor = parseDateInput(start);
    const last = parseDateInput(end);

    while (includeEndDate ? cursor <= last : cursor < last) {
      dates.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  };

  const parseDateInput = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseBookedDates = (element) => {
    try {
      return JSON.parse(element?.dataset.bookedDates || "[]");
    } catch (error) {
      console.error("Could not read booked dates", error);
      return [];
    }
  };

  const bookingForm = document.querySelector(".booking-form");
  let calendarClickState = {
    checkIn: "",
    checkOut: "",
  };
  let syncCalendarSelection = () => {};

  if (bookingForm) {
    const price = Number(bookingForm.dataset.price);
    const bookedDates = new Set(parseBookedDates(bookingForm));
    const checkInInput = bookingForm.querySelector("#checkIn");
    const checkOutInput = bookingForm.querySelector("#checkOut");
    const subtotal = bookingForm.querySelector("#bookingSubtotal");
    const gst = bookingForm.querySelector("#bookingGst");
    const total = bookingForm.querySelector("#bookingTotal");
    const warning = bookingForm.querySelector("#bookingDateWarning");
    const today = formatDateKey(new Date());

    checkInInput.min = today;
    checkOutInput.min = today;

    const selectedDatesAreBooked = () => {
      if (!checkInInput.value || !checkOutInput.value) return false;
      return getDatesBetween(checkInInput.value, checkOutInput.value, true).some((date) =>
        bookedDates.has(date)
      );
    };

    syncCalendarSelection = () => {
      document.querySelectorAll(".booking-calendar-day").forEach((item) => {
        const isEndpoint =
          item.dataset.date === calendarClickState.checkIn ||
          item.dataset.date === calendarClickState.checkOut;
        const isInRange =
          calendarClickState.checkIn &&
          calendarClickState.checkOut &&
          item.dataset.date > calendarClickState.checkIn &&
          item.dataset.date < calendarClickState.checkOut;

        item.classList.toggle("is-selected", isEndpoint);
        item.classList.toggle("is-in-range", Boolean(isInRange));
      });
    };

    const updateTotal = () => {
      warning.classList.toggle("d-none", !selectedDatesAreBooked());

      if (!checkInInput.value || !checkOutInput.value) {
        subtotal.textContent = formatCurrency(0);
        gst.textContent = formatCurrency(0);
        total.textContent = formatCurrency(0);
        checkOutInput.setCustomValidity("");
        syncCalendarSelection();
        return;
      }

      const checkIn = parseDateInput(checkInInput.value);
      const checkOut = parseDateInput(checkOutInput.value);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      if (nights <= 0) {
        subtotal.textContent = formatCurrency(0);
        gst.textContent = formatCurrency(0);
        total.textContent = formatCurrency(0);
        checkOutInput.setCustomValidity("Check-out must be after check-in.");
        syncCalendarSelection();
        return;
      }

      checkOutInput.setCustomValidity("");
      const subtotalAmount = nights * price;
      const gstAmount = Math.round(subtotalAmount * 0.18);
      subtotal.textContent = formatCurrency(subtotalAmount);
      gst.textContent = formatCurrency(gstAmount);
      total.textContent = formatCurrency(subtotalAmount + gstAmount);
      syncCalendarSelection();
    };

    checkInInput.addEventListener("change", () => {
      if (checkInInput.value) {
        const nextDay = parseDateInput(checkInInput.value);
        nextDay.setDate(nextDay.getDate() + 1);
        checkOutInput.min = formatDateKey(nextDay);
      }
      calendarClickState.checkIn = checkInInput.value;
      calendarClickState.checkOut = checkOutInput.value;
      updateTotal();
    });
    checkOutInput.addEventListener("change", () => {
      calendarClickState.checkIn = checkInInput.value;
      calendarClickState.checkOut = checkOutInput.value;
      updateTotal();
    });

    bookingForm.addEventListener("submit", (event) => {
      if (selectedDatesAreBooked()) {
        event.preventDefault();
        event.stopPropagation();
        warning.classList.remove("d-none");
      }
    });
  }

  const calendar = document.querySelector(".booking-calendar");
  if (calendar) {
    const grid = calendar.querySelector(".booking-calendar-grid");
    const title = calendar.querySelector("[data-calendar-title]");
    const prevButton = calendar.querySelector("[data-calendar-prev]");
    const nextButton = calendar.querySelector("[data-calendar-next]");
    const bookedDates = new Set(parseBookedDates(calendar));
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const visibleMonth = new Date(currentMonth);

    const renderCalendar = () => {
      grid.innerHTML = "";
      title.textContent = visibleMonth.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });

      const isCurrentMonth =
        visibleMonth.getFullYear() === currentMonth.getFullYear() &&
        visibleMonth.getMonth() === currentMonth.getMonth();
      prevButton.disabled = isCurrentMonth;

      const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
      const daysInMonth = new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() + 1,
        0
      ).getDate();

      for (let index = 0; index < firstDay.getDay(); index += 1) {
        const emptyEl = document.createElement("div");
        emptyEl.className = "booking-calendar-day is-empty";
        grid.append(emptyEl);
      }

      for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
        const day = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), dayNumber);
        const dateKey = formatDateKey(day);
        const isPast = day < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isBooked = bookedDates.has(dateKey);
        const dayEl = document.createElement("div");
        dayEl.className = "booking-calendar-day";
        dayEl.dataset.date = dateKey;
        dayEl.innerHTML = `<button type="button">${dayNumber}</button>`;
        dayEl.title = isBooked ? "Booked" : isPast ? "Past date" : "Available";

        if (isBooked) {
          dayEl.classList.add("is-booked");
          const dot = document.createElement("span");
          dot.className = "booked-dot";
          dayEl.append(dot);
        }

        if (isPast) {
          dayEl.classList.add("is-disabled");
        }

        dayEl.addEventListener("click", () => {
          const form = document.querySelector(".booking-form");
          if (!form || isBooked || isPast) return;

          const checkInInput = form.querySelector("#checkIn");
          const checkOutInput = form.querySelector("#checkOut");
          const updateEvent = new Event("change", { bubbles: true });

          if (dateKey === calendarClickState.checkIn) {
            calendarClickState.checkIn = "";
            checkInInput.value = "";
            checkInInput.dispatchEvent(updateEvent);
            return;
          }

          if (dateKey === calendarClickState.checkOut) {
            calendarClickState.checkOut = "";
            checkOutInput.value = "";
            checkOutInput.dispatchEvent(updateEvent);
            return;
          }

          if (!calendarClickState.checkIn || dateKey < calendarClickState.checkIn) {
            calendarClickState = { checkIn: dateKey, checkOut: "" };
            checkInInput.value = dateKey;
            checkOutInput.value = "";
            checkInInput.dispatchEvent(updateEvent);
          } else {
            calendarClickState.checkOut = dateKey;
            checkOutInput.value = dateKey;
            checkOutInput.dispatchEvent(updateEvent);
          }
        });

        grid.append(dayEl);
      }

      syncCalendarSelection();
    };

    prevButton.addEventListener("click", () => {
      visibleMonth.setMonth(visibleMonth.getMonth() - 1);
      renderCalendar();
    });

    nextButton.addEventListener("click", () => {
      visibleMonth.setMonth(visibleMonth.getMonth() + 1);
      renderCalendar();
    });

    renderCalendar();
  }
})();
