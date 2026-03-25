// ...existing code...
import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormArray, FormBuilder, FormGroup, FormControl } from '@angular/forms';

interface User {
  id: number;
  name: string;
}

interface Template {
  key: string;
  label: string;
  icon: string;
  text: string;
}

@Component({
  selector: 'app-message-template',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './message-template.component.html',
  styleUrls: ['./message-template.component.scss']
})
export class MessageTemplateComponent {
  @Output() messageSelected = new EventEmitter<string>();

  users: User[] = [
    { id: 1, name: '@KaterineAngarita' },
    { id: 4, name: '@MariAlejandra_Murcia' },
    { id: 5, name: '@cynthiaracas' },
    { id: 6, name: '@JMiroslawaEstrada' },
    { id: 7, name: '@Karenjuliethh' },
    { id: 8, name: '@GrisellQuiroz' },
    { id: 9, name: '@JohaGMora' },
    { id: 10, name: '@majovelasquez' },
    { id: 11, name: '@Erikcastro23' }
  ];

  form: FormGroup;
  templates: Template[] = [
    {
      key: 'acc',
      label: 'ACC ID',
      icon: '🚀',
      text: 'Buenas tardes team,\nSe asignó revisión de ACC ID del 13 de marzo para @usuarios, ya se creó la subtarea en Jira, por favor me confirmas cuando quede Done. ✅'
    },
    {
      key: 'retro',
      label: 'Retro',
      icon: '📢',
      text: 'Team buenas tardes,\nPor favor recuerden que hoy tenemos Retro, para que por favor lo diligencien. Feliz turno y los @usuarios.'
    },
    {
      key: 'label',
      label: 'Label',
      icon: '🏷️',
      text: 'Buenas tardes team,\nSe asignó revisión de Label para @usuarios, ya se creó la subtarea en Jira, por favor confirmar cuando esté Done. 📌'
    },
    {
      key: 'doc',
      label: 'Calidad Documento',
      icon: '📄',
      text: 'Buenas tardes se asigno revisión calidad documento para @usuarios.'
    },
    {
      key: 'face',
      label: 'Calidad Face',
      icon: '👤',
      text: 'Revisión calidad face para @usuarios.'
    },
    {
      key: 'risk',
      label: 'Reglas de Riesgo',
      icon: '⚠️',
      text: 'Revisión reglas de riesgo para @usuarios.'
    }
  ];
  activeTemplate = this.templates[0].key;
  messageText = this.templates[0].text.replace('@usuarios', '');

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      users: this.fb.array(this.users.map(() => false)),
      selectAll: [false]
    });
  }

  get usersArray() {
    return this.form.get('users') as FormArray;
  }

  toggleSelectAll() {
    const checked = this.form.get('selectAll')?.value;
    this.usersArray.controls.forEach(ctrl => ctrl.setValue(checked));
    this.updateMessage();
  }

  onUserChange() {
    const allSelected = this.usersArray.value.every((v: boolean) => v);
    this.form.get('selectAll')?.setValue(allSelected, { emitEvent: false });
    this.updateMessage();
  }

  get selectedUsers(): string[] {
    return this.users
      .filter((_, i) => this.usersArray.value[i])
      .map(u => u.name);
  }

  get message(): string {
    const template = this.templates.find(t => t.key === this.activeTemplate)?.text || '';
    return template.replace('@usuarios', this.selectedUsers.join(', '));
  }

  selectTemplate(key: string) {
    this.activeTemplate = key;
    this.updateMessage();
  }

  updateMessage() {
    const template = this.templates.find(t => t.key === this.activeTemplate);
    this.messageText = template ? template.text.replace('@usuarios', this.selectedUsers.join(', ')) : '';
    this.messageSelected.emit(this.messageText);
  }

  getUserControl(i: number): FormControl {
    return this.usersArray.at(i) as FormControl;
  }
}
