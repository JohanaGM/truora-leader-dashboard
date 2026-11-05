import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface BotDbLink {
  icon: string;
  title: string;
  desc: string;
  url: string;
}

@Component({
  selector: 'app-optibot-db',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './optibot-db.component.html',
  styleUrl: './optibot-db.component.scss'
})
export class OptibotDbComponent {
  readonly links: BotDbLink[] = [
    {
      icon: '🔔',
      title: 'Base Bot NotiAyuda',
      desc: 'Hoja de cálculo con la base de datos del bot NotiAyuda',
      url: 'https://docs.google.com/spreadsheets/d/1aof0PQaFjLf1sYJFBGsSfnN_4kcJRHZFe9IDIGVlaQ4/edit?gid=1884997553#gid=1884997553'
    },
    {
      icon: '🛠️',
      title: 'Base Bot Ops',
      desc: 'Hoja de cálculo con la base de datos del bot Ops',
      url: 'https://docs.google.com/spreadsheets/d/1GI90WGXwdMLib2u8bUoa68MsFxKrLxfgU4ia47250lA/edit?gid=0#gid=0'
    }
  ];
}
