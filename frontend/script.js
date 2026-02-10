document.addEventListener("DOMContentLoaded", () => {
  // --- Constants & State ---
  const state = {
    role: "user", // 'user' or 'admin'
    books: [
      { isbn: "978-3-16", title: "Introduction to Algorithms", author: "Cormen", genre: "CS", year: 2009, available: 5 },
      { isbn: "978-1-40", title: "Clean Code", author: "Robert Martin", genre: "CS", year: 2008, available: 3 },
      { isbn: "978-0-13", title: "Design Patterns", author: "Gamma et al.", genre: "CS", year: 1994, available: 0 },
      { isbn: "978-0-32", title: "You Don't Know JS", author: "Kyle Simpson", genre: "Web", year: 2015, available: 8 },
      { isbn: "978-1-49", title: "Eloquent JavaScript", author: "Marijn Haverbeke", genre: "Web", year: 2018, available: 12 },
    ],
    borrowed: [
      { title: "Operating System Concepts", due: "2023-10-25", status: "Overdue", daysLeft: -2 },
      { title: "Database System Concepts", due: "2023-11-05", status: "Active", daysLeft: 9 },
    ],
  };

  // --- Elements ---
  const roleSelect = document.getElementById("roleSelect");
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll(".section");
  const adminElements = document.querySelectorAll(".admin-only");
  
  // Dashboard Stats
  const statTotalBooks = document.getElementById("statTotalBooks");
  const statTotalUsers = document.getElementById("statTotalUsers");
  const statMyBorrowed = document.getElementById("statMyBorrowed");
  const topBooksTableBody = document.querySelector("#topBooksTable tbody");
  
  // Catalogs & Lists
  const booksGrid = document.getElementById("booksGrid");
  const borrowedTableBody = document.querySelector("#borrowedTable tbody");
  const borrowSummaryList = document.getElementById("borrowedSummaryList");

  // --- Initialization ---
  function init() {
    renderStats();
    renderTopBooks();
    renderBookCatalog();
    renderBorrowed();
    updateRoleUI();
    
    // Event Listeners
    roleSelect.addEventListener("change", (e) => {
      state.role = e.target.value;
      updateRoleUI();
    });

    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        const target = link.dataset.section;
        navigateTo(target);
      });
    });

    // Mock Book Add
    const bookForm = document.getElementById("bookForm");
    if(bookForm) {
      bookForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const newBook = {
          isbn: document.getElementById("bookIsbn").value,
          title: document.getElementById("bookTitle").value,
          author: document.getElementById("bookAuthor").value,
          genre: document.getElementById("bookGenre").value,
          year: document.getElementById("bookYear").value,
          available: parseInt(document.getElementById("bookQuantity").value) || 1
        };
        state.books.push(newBook);
        renderBookCatalog();
        renderTopBooks();
        renderStats();
        bookForm.reset();
        alert("Book added to mock catalog!");
      });
    }
  }

  // --- Rendering Functions ---

  function renderStats() {
    statTotalBooks.innerText = state.books.reduce((acc, b) => acc + b.available, 0);
    statTotalUsers.innerText = "1,245"; // Static mock
    statMyBorrowed.innerText = state.borrowed.length;
  }

  function renderTopBooks() {
    // Show first 5 available books
    const available = state.books.filter(b => b.available > 0).slice(0, 5);
    topBooksTableBody.innerHTML = available.map(book => `
      <tr>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${book.genre}</td>
        <td>2023-09-01</td>
        <td>${book.available}</td>
      </tr>
    `).join("");
  }

  function renderBookCatalog(filter = "") {
    booksGrid.innerHTML = state.books.map(book => `
      <div class="book-card">
        <div class="book-cover">📖</div>
        <span class="book-title">${book.title}</span>
        <div class="book-author">${book.author}</div>
        <div style="margin-top:0.5rem; font-size:0.8rem; color:${book.available > 0 ? 'green' : 'red'}">
          ${book.available > 0 ? `${book.available} Available` : 'Out of Stock'}
        </div>
      </div>
    `).join("");
  }

  function renderBorrowed() {
    // Populate detailed table
    borrowedTableBody.innerHTML = state.borrowed.map(b => `
      <tr>
        <td>${b.title}</td>
        <td>${b.due}</td>
        <td><span class="chip ${b.status === 'Overdue' ? 'chip-danger' : ''}">${b.status}</span></td>
        <td>${b.daysLeft}</td>
      </tr>
    `).join("");

    // Populate dashboard summary list
    borrowSummaryList.innerHTML = state.borrowed.map(b => `
      <li>
        <strong>${b.title}</strong> - Due: ${b.due}
      </li>
    `).join("");
  }

  // --- UI Actions ---

  function navigateTo(sectionId) {
    // Update Nav
    navLinks.forEach(l => l.classList.remove("active"));
    document.querySelector(`.nav-link[data-section="${sectionId}"]`)?.classList.add("active");

    // Update Section
    sections.forEach(s => s.classList.remove("section-active"));
    document.getElementById(sectionId)?.classList.add("section-active");
  }

  function updateRoleUI() {
    // Show/Hide Elements based on role
    if (state.role === "admin") {
      document.body.classList.add("role-admin");
      adminElements.forEach(el => el.style.display = "block");
    } else {
      document.body.classList.remove("role-admin");
      adminElements.forEach(el => el.style.display = "none");
    }
    
    // Update Topbar subtitle
    const sub = document.getElementById("topbarSubtitle");
    if(sub) sub.innerText = state.role === "admin" ? "Admin / Librarian Dashboard" : "User Dashboard";
  }

  // Start App
  init();
});